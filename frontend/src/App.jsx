import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInMilliseconds, parseISO } from "date-fns";
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaCheck,
  FaBars,
  FaDownload,
  FaUndo,
  FaSearch,
} from "react-icons/fa";
import "./App.css";

/* -------------------------
   Constants & helpers
   ------------------------- */
const API_TODOS = "https://task-manager3-1lon.onrender.com/api/todos";
const COLUMNS_KEY = "tm_vmax_columns";
const TASKS_KEY = "tm_vmax_tasks";
const ACTIVITY_KEY = "tm_vmax_activity";
const THEME_KEY = "tm_vmax_theme";

const DEFAULT_COLUMNS = [
  { id: "to do", title: "To Do" },
  { id: "inprogress", title: "In Progress" },
  { id: "done", title: "Done" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

/* Safe fetch helper that returns parsed JSON or null on failure */
async function tryBackend(url, method = "POST", body = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    try {
      return await res.json();
    } catch {
      return {};
    }
  } catch {
    return null;
  }
}

/* CSV helpers */
const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const arrayToCsv = (rows) => rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* -------------------------
   Small presentational components
   ------------------------- */
function IconButton({ children, title, onClick, className = "" }) {
  return (
    <button
      className={`icon-btn ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Snackbar({ open, message, actionLabel, onAction, onClose }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="snackbar"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
        >
          <div className="snack-message">{message}</div>
          {actionLabel && (
            <button className="snack-action" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <motion.div
        className="modal-card"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
      >
        <div className="modal-close">
          <IconButton title="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="modal-content">{children}</div>
      </motion.div>
    </div>
  );
}

/* Card editor modal */
function CardEditor({
  task = {},
  onSave,
  onCancel,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
}) {
  const [title, setTitle] = useState(task.text || "");
  const [description, setDescription] = useState(task.description || "");
  const [due, setDue] = useState(task.due_date || "");
  const [priority, setPriority] = useState(task.priority || "Low");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setTitle(task.text || "");
    setDescription(task.description || "");
    setDue(task.due_date || "");
    setPriority(task.priority || "Low");
    setTagInput("");
  }, [task]);

  const save = () => onSave?.({ ...task, text: title, description, due_date: due, priority });
  const addTag = () => {
    if (!tagInput.trim()) return;
    const tags = Array.from(new Set([...(task.tags || []), tagInput.trim()]));
    onSave?.({ ...task, tags });
    setTagInput("");
  };

  return (
    <div className="card-editor">
      <h3>Edit Card</h3>

      <label>Title</label>
      <input className="edit-input" value={title} onChange={(e) => setTitle(e.target.value)} />

      <label>Description</label>
      <textarea
        className="edit-input"
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="row" style={{ gap: 8 }}>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>

      <div className="tags-block">
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          <IconButton title="Add tag" onClick={addTag}>
            <FaPlus />
          </IconButton>
        </div>
        <div className="tags-list">
          {(task.tags || []).map((t) => (
            <div key={t} className="badge small">
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="subtasks-block">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Subtasks</strong>
          <IconButton title="Add subtask" onClick={() => onAddSubtask(task.id, `Subtask ${Date.now()}`)}>
            <FaPlus />
          </IconButton>
        </div>

        {(task.subtasks || []).map((s) => (
          <div key={s.id} className="row subtask-row">
            <input type="checkbox" checked={!!s.done} onChange={() => onToggleSubtask(task.id, s.id)} />
            <div className="subtask-title">{s.title}</div>
            <IconButton title="Remove subtask" onClick={() => onRemoveSubtask(task.id, s.id)}>
              <FaTrash />
            </IconButton>
          </div>
        ))}
      </div>

      <div className="actions-row">
        <button className="action-btn" onClick={save}>
          Save
        </button>
        <button className="action-btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* Quick inline add */
function QuickAddInline({ onAdd }) {
  const [v, setV] = useState("");
  return (
    <div className="quick-add-inline">
      <input
        placeholder="Quick add..."
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            onAdd(v.trim());
            setV("");
          }
        }}
      />
      <button
        className="add-small"
        onClick={() => {
          if (!v.trim()) return;
          onAdd(v.trim());
          setV("");
        }}
      >
        Add
      </button>
    </div>
  );
}

/* -------------------------
   Main App
   ------------------------- */
export default function App() {
  // state (persisted)
  const [columns, setColumns] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COLUMNS_KEY)) || DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });
  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [activity, setActivity] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || "mint");

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("All");
  const [sortBy, setSortBy] = useState("position");
  const [modalTask, setModalTask] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: "", action: null });
  const [undoPayload, setUndoPayload] = useState(null);

  // search highlights (set of task ids)
  const [highlighted, setHighlighted] = useState(() => new Set());

  // refs
  const remindersRef = useRef({});
  const fileInputRef = useRef(null);

  // add form
  const [newText, setNewText] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState("Low");

  /* Persist localStorage & theme */
  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 200)));
  }, [activity]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* Ensure tasks referencing removed columns are moved to first column */
  useEffect(() => {
    const valid = new Set(columns.map((c) => c.id));
    const dest = columns[0]?.id || DEFAULT_COLUMNS[0].id;
    let changed = false;
    const next = tasks.map((t) => {
      if (t.status && !valid.has(t.status)) {
        changed = true;
        return { ...t, status: dest };
      }
      return t;
    });
    if (changed) setTasks(next);
  }, [columns, tasks]);

  const pushActivity = useCallback((txt) => {
    setActivity((s) => [{ id: uid(), text: txt, at: new Date().toISOString() }, ...s].slice(0, 200));
  }, []);

  /* -------------------------
     Backend sync
  -------------------------- */
  const normalizeFromBackend = useCallback(
    (b) => {
      // backend returns fields like dueDate and reminder_enabled
      return {
        id: String(b.id ?? b.id ?? uid()),
        text: b.text ?? "",
        description: b.description ?? "",
        completed: !!b.completed,
        due_date: b.dueDate ?? b.due_date ?? "",
        priority: b.priority ?? "Low",
        reminder_enabled: typeof b.reminder_enabled !== "undefined" ? !!b.reminder_enabled : true,
        // status & position are client-side; default to first column
        status: b.status ?? columns[0]?.id ?? DEFAULT_COLUMNS[0].id,
        position: typeof b.position !== "undefined" ? b.position : 0,
        tags: Array.isArray(b.tags) ? b.tags : [],
        subtasks: Array.isArray(b.subtasks) ? b.subtasks : [],
      };
    },
    [columns]
  );

  const fetchTodos = useCallback(async () => {
    const data = await tryBackend(API_TODOS, "GET", {});
    if (!data) {
      pushActivity("Failed to fetch todos from server");
      return;
    }
    // assume `data` is array of todos
    if (!Array.isArray(data)) return;
    const mapped = data.map(normalizeFromBackend);
    setTasks((prev) => {
      // Merge server tasks with local (preserve local-only fields like status if id matches)
      const localById = new Map(prev.map((t) => [t.id, t]));
      const merged = mapped.map((s) => {
        const local = localById.get(s.id);
        if (!local) return s;
        // prefer local.status/position if present
        return { ...s, status: local.status ?? s.status, position: local.position ?? s.position };
      });
      // also keep local tasks that don't exist on server (temporary local items)
      const serverIds = new Set(merged.map((m) => m.id));
      const localsOnly = prev.filter((t) => !serverIds.has(t.id));
      return [...merged, ...localsOnly];
    });
    pushActivity("Synchronized todos from server");
  }, [normalizeFromBackend, pushActivity]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  /* -------------------------
     Single Browser Reminder (one-time per session)
  -------------------------- */
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const toDateOnlyString = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const todayStr = toDateOnlyString(new Date());

    const dueTasks = tasks.filter((task) => {
      if (!task?.due_date) return false;
      if (task.completed || task.status === "done") return false;
      if (notifiedRef.current.has(task.id)) return false;

      let dt;
      try {
        dt = parseISO(String(task.due_date));
      } catch {
        return false;
      }

      const dueStr = toDateOnlyString(dt);
      const isDueToday = dueStr === todayStr;
      const isOverdue = dueStr < todayStr;

      return isDueToday || isOverdue;
    });

    if (dueTasks.length === 0) return;

    dueTasks.forEach((t) => notifiedRef.current.add(t.id));

    const title =
      dueTasks.length === 1 ? `Task due: ${dueTasks[0].text}` : `${dueTasks.length} tasks need your attention`;

    const lines = dueTasks
      .slice(0, 5)
      .map((t, i) => `${i + 1}. ${t.text} (${toDateOnlyString(parseISO(t.due_date))})`);

    if (dueTasks.length > 5) lines.push(`…and ${dueTasks.length - 5} more`);

    const body = lines.join("\n");

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {}
    }

    pushActivity(`Reminder triggered for ${dueTasks.length} task(s)`);
  }, [tasks, pushActivity]);

  /* Derived column -> tasks mapping (with sorting) */
  const colMap = useMemo(() => {
    const map = {};
    columns.forEach((c) => (map[c.id] = []));
    tasks.forEach((t) => {
      const cid = t.status || (t.completed ? "done" : columns[0]?.id);
      if (!map[cid]) map[cid] = [];
      map[cid].push(t);
    });

    Object.keys(map).forEach((k) => {
      if (sortBy === "position") map[k].sort((a, b) => (a.position || 0) - (b.position || 0));
      if (sortBy === "due") map[k].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
      if (sortBy === "priority") {
        const order = { High: 1, Medium: 2, Low: 3 };
        map[k].sort((a, b) => (order[a.priority] || 3) - (order[b.priority] || 3));
      }
    });

    return map;
  }, [tasks, columns, sortBy]);

  /* Add task */
  const addTask = useCallback(
    async (columnId = columns[0]?.id) => {
      if (!newText.trim()) return;
      const t = {
        id: uid(),
        text: newText.trim(),
        completed: false,
        status: columnId,
        due_date: newDue || "",
        priority: newPriority || "Low",
        position: (colMap[columnId] || []).length,
        tags: [],
        subtasks: [],
        description: "",
      };
      // optimistic
      setTasks((s) => [t, ...s]);
      setNewText("");
      setNewDue("");
      setNewPriority("Low");
      pushActivity(`Added "${t.text}"`);

      // notify backend then refresh
      try {
        await tryBackend(API_TODOS, "POST", {
          text: t.text,
          completed: t.completed,
          dueDate: t.due_date,
          priority: t.priority,
          reminder_enabled: true,
        });
        await fetchTodos();
      } catch {
        pushActivity("Failed to add task on server");
      }
    },
    [newText, newDue, newPriority, columns, colMap, pushActivity, fetchTodos]
  );

  /* Update task — auto-move to done/first column when completed toggled */
  const updateTask = useCallback(
    async (id, updates) => {
      setTasks((prev) => {
        const doneColId = columns.find((c) => c.id === "done")?.id || (columns.length ? columns[columns.length - 1].id : "done");
        const firstColId = columns[0]?.id || DEFAULT_COLUMNS[0].id;

        const snapshot = {};
        columns.forEach((c) => (snapshot[c.id] = []));
        prev.forEach((t) => {
          const cid = t.status || (t.completed ? doneColId : firstColId);
          if (!snapshot[cid]) snapshot[cid] = [];
          snapshot[cid].push(t);
        });

        return prev.map((t) => {
          if (t.id !== id) return t;
          let newStatus = t.status;
          if (typeof updates.completed === "boolean") {
            newStatus = updates.completed ? doneColId : firstColId;
          }
          const sameColumn = newStatus === t.status;
          const newPosition = sameColumn
            ? typeof updates.position !== "undefined"
              ? updates.position
              : t.position
            : snapshot[newStatus]?.length || 0;
          return { ...t, ...updates, status: newStatus, position: newPosition };
        });
      });

      pushActivity(`Updated task ${id}`);
      try {
        // map client field names to backend expected names
        const payload = {};
        if (typeof updates.text !== "undefined") payload.text = updates.text;
        if (typeof updates.completed !== "undefined") payload.completed = updates.completed;
        if (typeof updates.priority !== "undefined") payload.priority = updates.priority;
        if (typeof updates.due_date !== "undefined") payload.dueDate = updates.due_date;
        if (typeof updates.position !== "undefined") payload.position = updates.position;
        await tryBackend(`${API_TODOS}/${id}`, "PUT", payload);
        await fetchTodos();
      } catch {
        pushActivity("Failed to update task on server");
      }
    },
    [pushActivity, columns, fetchTodos]
  );

  /* Delete with undo */
  const deleteTask = useCallback(
    async (id) => {
      const found = tasks.find((x) => x.id === id);
      if (!found) return;
      setTasks((s) => s.filter((x) => x.id !== id));
      setUndoPayload({ type: "delete", data: found });
      setSnack({ open: true, message: `Deleted "${found.text}"`, action: "Undo" });
      pushActivity(`Deleted "${found.text}"`);
      try {
        await tryBackend(`${API_TODOS}/${id}`, "DELETE", {});
        await fetchTodos();
      } catch {
        pushActivity("Failed to delete task on server");
      }
    },
    [tasks, pushActivity, fetchTodos]
  );

  const undo = useCallback(() => {
    if (!undoPayload) return;
    if (undoPayload.type === "delete" && undoPayload.data) {
      setTasks((s) => [undoPayload.data, ...s]);
      pushActivity(`Restored "${undoPayload.data.text}"`);
    }
    setUndoPayload(null);
    setSnack({ open: false, message: "", action: null });
  }, [undoPayload, pushActivity]);

  /* Drag & drop handling */
  const onDragEnd = useCallback(
    async (result) => {
      const { source, destination, type } = result;
      if (!destination) return;

      if (type === "COLUMN") {
        const copy = Array.from(columns);
        const [removed] = copy.splice(source.index, 1);
        copy.splice(destination.index, 0, removed);
        setColumns(copy);
        pushActivity("Reordered columns");
        return;
      }

      const srcCol = source.droppableId;
      const dstCol = destination.droppableId;

      if (srcCol === dstCol) {
        const columnTasks = Array.from(colMap[srcCol] || []);
        const [moved] = columnTasks.splice(source.index, 1);
        columnTasks.splice(destination.index, 0, moved);

        const reordered = new Map(columnTasks.map((task, idx) => [task.id, { ...task, position: idx }] ));
        setTasks((prev) => prev.map((t) => (t.status !== srcCol ? t : reordered.get(t.id) || t)));
        if (moved) pushActivity(`Reordered "${moved.text}"`);
        try {
          await tryBackend(`${API_TODOS}/${moved.id}`, "PUT", { position: destination.index });
          await fetchTodos();
        } catch {
          pushActivity("Failed to persist reorder to server");
        }
        return;
      }

      // cross-column move
      const srcList = Array.from(colMap[srcCol] || []);
      const dstList = Array.from(colMap[dstCol] || []);
      const [moved] = srcList.splice(source.index, 1);
      if (!moved) return;

      const updatedMoved = { ...moved, status: dstCol, completed: dstCol === "done" ? true : moved.completed };
      dstList.splice(destination.index, 0, updatedMoved);

      const srcUpdated = srcList.map((task, idx) => ({ ...task, position: idx }));
      const dstUpdated = dstList.map((task, idx) => ({ ...task, position: idx }));

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id === moved.id) return updatedMoved;
          if (task.status === srcCol) {
            const repl = srcUpdated.find((t) => t.id === task.id);
            return repl || task;
          }
          if (task.status === dstCol) {
            const repl = dstUpdated.find((t) => t.id === task.id);
            return repl || task;
          }
          return task;
        })
      );

      pushActivity(`Moved "${moved.text}"`);
      try {
        await tryBackend(`${API_TODOS}/${moved.id}`, "PUT", {
          status: updatedMoved.status,
          completed: updatedMoved.completed,
          position: destination.index,
        });
        await fetchTodos();
      } catch {
        pushActivity("Failed to move task on server");
      }
    },
    [columns, colMap, tasks, pushActivity, fetchTodos]
  );

  /* Quick add */
  const quickAddToColumn = useCallback(
    (colId, text) => {
      if (!text.trim()) return;
      const t = {
        id: uid(),
        text,
        status: colId,
        completed: false,
        position: (colMap[colId] || []).length,
        tags: [],
        subtasks: [],
        description: "",
      };
      setTasks((s) => [t, ...s]);
      pushActivity(`Quick-added "${text}"`);
    },
    [colMap, pushActivity]
  );

  /* Export helpers (CSV) */
  const CSV_BOM = "\uFEFF";

  const exportTasksCSV = useCallback(() => {
    try {
      const headers = [
        "id",
        "text",
        "description",
        "status",
        "priority",
        "due_date",
        "completed",
        "position",
        "tags",
        "subtasks",
      ];
      const rows = [headers];
      tasks.forEach((t) =>
        rows.push([
          t.id ?? "",
          t.text ?? "",
          t.description ?? "",
          t.status ?? "",
          t.priority ?? "",
          t.due_date ?? "",
          t.completed ? "true" : "false",
          typeof t.position !== "undefined" ? String(t.position) : "",
          JSON.stringify(t.tags || []),
          JSON.stringify(t.subtasks || []),
        ])
      );
      const csv = CSV_BOM + arrayToCsv(rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `taskmaster-tasks-${Date.now()}.csv`);
    } catch (err) {
      console.error("exportTasksCSV failed:", err);
      alert("Failed to export tasks CSV.");
    }
  }, [tasks]);

  const exportColumnsCSV = useCallback(() => {
    try {
      const rows = [["id", "title"], ...columns.map((c) => [c.id ?? "", c.title ?? ""])];
      const csv = CSV_BOM + arrayToCsv(rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `taskmaster-columns-${Date.now()}.csv`);
    } catch (err) {
      console.error("exportColumnsCSV failed:", err);
      alert("Failed to export columns CSV.");
    }
  }, [columns]);

  const exportActivityCSV = useCallback(() => {
    try {
      const rows = [["id", "text", "at"], ...activity.map((a) => [a.id ?? "", a.text ?? "", a.at ?? ""])];
      const csv = CSV_BOM + arrayToCsv(rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `taskmaster-activity-${Date.now()}.csv`);
    } catch (err) {
      console.error("exportActivityCSV failed:", err);
      alert("Failed to export activity CSV.");
    }
  }, [activity]);

  const exportBoard = useCallback(
    (mode = "json") => {
      if (mode === "csv") {
        exportTasksCSV();
        return;
      }
      if (mode === "all") {
        exportTasksCSV();
        exportColumnsCSV();
        exportActivityCSV();
        return;
      }
      const payload = { columns, tasks, activity, meta: { exportedAt: new Date().toISOString() } };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `taskmaster-board-${Date.now()}.json`);
    },
    [columns, tasks, activity, exportTasksCSV, exportColumnsCSV, exportActivityCSV]
  );

  /* Filters & helpers (improved - case-insensitive, safe handling of undefined) */
  const filteredColMap = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    const map = {};
    Object.keys(colMap).forEach((cid) => {
      map[cid] = (colMap[cid] || []).filter((t) => {
        // Priority filter
        if (filterPriority !== "All" && t.priority !== filterPriority) return false;

        // If there's no query, include task
        if (!q) return true;

        // Build searchable string safely
        const text = String(t.text || "");
        const desc = String(t.description || "");
        const tags = Array.isArray(t.tags) ? t.tags.join(" ") : String(t.tags || "");
        const composed = `${text} ${desc} ${tags}`.toLowerCase();

        return composed.includes(q);
      });
    });

    return map;
  }, [colMap, search, filterPriority]);

  // search handler — finds matches and highlights them (no scrolling)
  const handleSearchClick = useCallback(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) {
      setHighlighted(new Set());
      return;
    }
    const matches = new Set();
    tasks.forEach((t) => {
      if (!t) return;
      // include completed tasks by default; if you want to exclude completed, skip here
      const text = String(t.text || "");
      const desc = String(t.description || "");
      const tags = Array.isArray(t.tags) ? t.tags.join(" ") : String(t.tags || "");
      const composed = `${text} ${desc} ${tags}`.toLowerCase();
      if (composed.includes(q)) matches.add(t.id);
    });
    setHighlighted(matches);
  }, [search, tasks]);

  // prune highlights when tasks change (remove ids that no longer exist)
  useEffect(() => {
    if (highlighted.size === 0) return;
    const ids = new Set(tasks.map((t) => t.id));
    const next = new Set([...highlighted].filter((id) => ids.has(id)));
    if (next.size !== highlighted.size) setHighlighted(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const clearActivity = useCallback(() => {
    if (window.confirm("Clear activity?")) setActivity([]);
  }, []);

  const addColumn = useCallback(() => {
    const title = window.prompt("New column title");
    if (!title) return;
    const col = { id: title.toLowerCase().replace(/\s+/g, "_") + "_" + uid(), title };
    setColumns((s) => [...s, col]);
    pushActivity(`Added column "${title}"`);
  }, [pushActivity]);

  const removeColumn = useCallback(
    (colId) => {
      if (!window.confirm("Delete column and move tasks to first column?")) return;
      const dest = columns[0].id;
      setTasks((s) => s.map((t) => (t.status === colId ? { ...t, status: dest } : t)));
      setColumns((s) => s.filter((c) => c.id !== colId));
      pushActivity(`Removed column ${colId}`);
    },
    [columns, pushActivity]
  );

  /* Subtask / tag helpers */
  const addSubtask = useCallback(
    (taskId, title) => {
      setTasks((s) => s.map((t) => (t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), { id: uid(), title, done: false }] } : t)));
      pushActivity("Added subtask");
    },
    [pushActivity]
  );

  const toggleSubtask = useCallback(
    (taskId, subId) => {
      setTasks((s) => s.map((t) => (t.id === taskId ? { ...t, subtasks: (t.subtasks || []).map((su) => (su.id === subId ? { ...su, done: !su.done } : su)) } : t)));
    },
    []
  );

  const removeSubtask = useCallback(
    (taskId, subId) => {
      setTasks((s) => s.map((t) => (t.id === taskId ? { ...t, subtasks: (t.subtasks || []).filter((su) => su.id !== subId) } : t)));
    },
    []
  );

  const toggleTag = useCallback(
    (taskId, tag) => {
      setTasks((s) =>
        s.map((t) => {
          if (t.id !== taskId) return t;
          const tags = new Set(t.tags || []);
          if (tags.has(tag)) tags.delete(tag);
          else tags.add(tag);
          return { ...t, tags: Array.from(tags) };
        })
      );
    },
    []
  );

  const closeSnack = useCallback(() => setSnack({ open: false, message: "", action: null }), []);
  const counts = useMemo(() => {
    const c = { all: tasks.length };
    columns.forEach((col) => (c[col.id] = (colMap[col.id] || []).length));
    return c;
  }, [tasks, columns, colMap]);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) importBoard(f);
    e.target.value = null;
  };

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="app-container premium-vmax" style={{ paddingBottom: 80 }}>
      <header className="header">
        <div className="header-left">
          <IconButton title="Toggle sidebar" onClick={() => setSidebarOpen((s) => !s)}>
            <FaBars />
          </IconButton>
          <div>
            <h1 className="title">TaskMaster</h1>
            <div className="muted">{tasks.length} tasks • {columns.length} columns</div>
          </div>
        </div>

        <div className="header-right">
          <div className="search-box" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="Search tasks or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchClick();
                }
              }}
              autoComplete="off"
              aria-label="Search tasks"
              style={{ flex: 1 }}
            />
            <button
              className="icon-btn"
              title="Search"
              aria-label="Search"
              onClick={handleSearchClick}
              style={{ width: 40, height: 36 }}
            >
              <FaSearch />
            </button>
          </div>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option>All</option><option>Low</option><option>Medium</option><option>High</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="position">Order</option>
            <option value="priority">Priority</option>
            <option value="due">Due Date</option>
          </select>
        </div>
      </header>

      <div className={`layout-wrapper ${sidebarOpen ? "" : "sidebar-closed"}`}>
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-inner">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong>Boards</strong>
              <IconButton title="Add column" onClick={addColumn}><FaPlus /></IconButton>
            </div>

            <div className="sidebar-list">
              {columns.map((c) => (
                <div key={c.id} className="sidebar-item">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{c.title}</div>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="muted">{(colMap[c.id] || []).length}</div>
                      <IconButton title="Remove" onClick={() => removeColumn(c.id)}><FaTrash /></IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="board-main" style={{ minHeight: 560 }}>
          <div className="add-row">
            <div className="add-box">
              <input
                id="add-input"
                placeholder="Add new task..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask(columns[0]?.id)}
              />
              <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
              <button className="add-btn" onClick={() => addTask(columns[0]?.id)}><FaPlus /></button>
            </div>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="board" type="COLUMN" direction="horizontal">
              {(provided) => (
                <div className="board" ref={provided.innerRef} {...provided.droppableProps}>
                  {columns.map((col, idx) => (
                    <Draggable key={col.id} draggableId={col.id} index={idx}>
                      {(prov) => (
                        <section className="column" ref={prov.innerRef} {...prov.draggableProps} style={prov.draggableProps.style}>
                          <div className="column-header" {...prov.dragHandleProps}>
                            <div>{col.title}</div>
                            <div className="count-badge">{(colMap[col.id] || []).length}</div>
                          </div>

                          <Droppable droppableId={col.id} type="TASK">
                            {(dropProv, snapshot) => (
                              <div
                                ref={dropProv.innerRef}
                                {...dropProv.droppableProps}
                                className={`column-body ${snapshot.isDraggingOver ? "drag-over" : ""}`}
                              >
                                {(filteredColMap[col.id] || []).map((task, i) => (
                                  <Draggable key={task.id} draggableId={task.id} index={i}>
                                    {(tprov) => (
                                      <motion.div
                                        className={`task-card ${highlighted.has(task.id) ? "highlight" : ""}`}
                                        ref={tprov.innerRef}
                                        {...tprov.draggableProps}
                                        {...tprov.dragHandleProps}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                      >
                                        <div className="task-top-row">
                                          <div className="task-meta">
                                            <div className="task-title">{task.text}</div>
                                            <div className="row" style={{ gap: 8, marginTop: 6, alignItems: "center" }}>
                                              <div className={`badge ${task.priority?.toLowerCase()}`}>{task.priority}</div>
                                              <div className="muted">
                                                {task.due_date ? `📅 ${format(parseISO(task.due_date), "MMM d, yyyy")}` : ""}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="task-actions">
                                            <IconButton
                                              title={task.completed ? "Mark incomplete" : "Mark done"}
                                              onClick={() => updateTask(task.id, { completed: !task.completed })}
                                            >
                                              <FaCheck style={{ color: task.completed ? "var(--accent)" : "var(--muted)" }} />
                                            </IconButton>

                                            <div className="row" style={{ gap: 6 }}>
                                              <IconButton title="Edit" onClick={() => setModalTask(task)}><FaEdit /></IconButton>
                                              <IconButton title="Delete" onClick={() => deleteTask(task.id)}><FaTrash /></IconButton>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </Draggable>
                                ))}
                                {dropProv.placeholder}
                                <div style={{ marginTop: 8 }}>
                                  <QuickAddInline onAdd={(txt) => quickAddToColumn(col.id, txt)} />
                                </div>
                              </div>
                            )}
                          </Droppable>
                        </section>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </main>

        <aside className="activity-panel">
          <div style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong>Activity</strong>
              <div className="row" style={{ gap: 8 }}>
                <IconButton title="Clear" onClick={clearActivity}><FaTrash /></IconButton>
                <IconButton title="Export CSV" onClick={() => exportBoard("csv")}><FaDownload /></IconButton>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {activity.length === 0 && <div className="muted">No activity yet</div>}
              {activity.map((a) => (
                <div key={a.id} className="activity-item">
                  <div>{a.text}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{format(parseISO(a.at), "PPpp")}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Snackbar open={snack.open} message={snack.message} actionLabel={snack.action} onAction={undo} onClose={closeSnack} />

      <AnimatePresence>
        {undoPayload && (
          <motion.div className="undo-pill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {undoPayload.data?.text} <button onClick={undo}><FaUndo /> Undo</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalTask && (
          <Modal onClose={() => setModalTask(null)}>
            <CardEditor
              task={modalTask}
              onSave={(edited) => {
                updateTask(edited.id, edited);
                setModalTask(null);
              }}
              onCancel={() => setModalTask(null)}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onRemoveSubtask={removeSubtask}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
