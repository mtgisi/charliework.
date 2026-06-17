import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api.js';
import {
  Mark, PinIcon, DragIcon, CloseIcon, QuestionIcon, NoteIcon, ReviewIcon, BlockedIcon, ChevronDownSmall,
} from './icons.jsx';

const AssigneeContext = React.createContext([]);
function lookupAssigneeLabel(handle, assignees) {
  const hit = assignees?.find(a => a.value === handle);
  return hit ? hit.label : handle;
}
const CATEGORY_LABELS = {
  tech: 'Technology',
  biz_comp: 'Business & Computers',
  esports: 'Esports',
  robotics: 'Robotics',
  st_croix: 'St. Croix',
  ultimate: 'Ultimate Frisbee',
  personal: 'Personal',
};
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORY_BG = {
  tech: '#eff6ff', biz_comp: '#fffbeb', esports: '#f5f3ff',
  robotics: '#fef2f2', st_croix: '#f0fdf4', ultimate: '#fdf2f8',
  personal: '#f1f5f9',
};
const CATEGORY_BG_DARK = {
  tech: '#1e3a8a40', biz_comp: '#78350f40', esports: '#4c1d9540',
  robotics: '#7f1d1d40', st_croix: '#14532d40', ultimate: '#83184340',
  personal: '#33415540',
};
const CATEGORY_ACCENT = {
  tech: '#2563eb', biz_comp: '#d97706', esports: '#7c3aed',
  robotics: '#dc2626', st_croix: '#16a34a', ultimate: '#db2777',
  personal: '#64748b',
};

function parseCats(value) {
  if (!value) return [];
  return String(value).split(',').map(s => s.trim()).filter(s => s && CATEGORY_LABELS[s]);
}
const CHARLIE_IMG = 'https://static.wikia.nocookie.net/itsalwayssunny/images/6/6c/1x6_Charlie_in_cleaning_gear.png/revision/latest?cb=20110817031411';

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtDateShort(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const THEME_KEY = 'cw-theme';
function loadTheme() {
  const t = localStorage.getItem(THEME_KEY);
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', t === 'dark' ? '#121211' : '#F7F6F2'
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function StatusBadge({ task }) {
  if (task.is_overdue) return <span className="badge badge-late"><span className="pip" />Overdue</span>;
  if (task.is_due_soon) return <span className="badge badge-soon"><span className="pip" />Due soon</span>;
  return null;
}

function AssigneeBadge({ handle }) {
  const assignees = React.useContext(AssigneeContext);
  return <span className="badge badge-neutral">{lookupAssigneeLabel(handle, assignees)}</span>;
}

function CategoryBadges({ category }) {
  const cats = parseCats(category);
  if (!cats.length) return null;
  return (
    <>
      {cats.map(c => (
        <span key={c} className={`badge badge-cat cat-${c}`}>{CATEGORY_LABELS[c]}</span>
      ))}
    </>
  );
}

function CategoryChipPicker({ value, onChange }) {
  const selected = new Set(parseCats(value));
  const toggle = (slug) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    const arr = CATEGORY_OPTIONS.map(o => o.value).filter(v => next.has(v));
    onChange(arr.join(',') || null);
  };
  return (
    <div className="cat-picker">
      {CATEGORY_OPTIONS.map(c => (
        <button
          type="button"
          key={c.value}
          className={`cat-chip cat-${c.value}${selected.has(c.value) ? ' on' : ''}`}
          onClick={() => toggle(c.value)}
          aria-pressed={selected.has(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function buildCategoryStyle(category, dark, awaitingReview = false) {
  const cats = parseCats(category);
  const reviewBg = dark
    ? 'linear-gradient(135deg, #7f1d1d33, #b9151533)'
    : 'linear-gradient(135deg, #fee2e2, #fecaca)';
  if (!cats.length) {
    if (awaitingReview) return { background: reviewBg };
    return undefined;
  }
  const bgMap = dark ? CATEGORY_BG_DARK : CATEGORY_BG;
  if (cats.length === 1) {
    return {
      background: awaitingReview ? reviewBg : bgMap[cats[0]],
      boxShadow: `inset 4px 0 0 0 ${CATEGORY_ACCENT[cats[0]]}`,
      paddingLeft: 12,
    };
  }
  const bgStops = cats.map((c, i) => `${bgMap[c]} ${(i / (cats.length - 1)) * 100}%`).join(', ');
  const accentStops = `linear-gradient(to bottom, ${cats.map((c, i) => `${CATEGORY_ACCENT[c]} ${(i / (cats.length - 1)) * 100}%`).join(', ')})`;
  return {
    background: awaitingReview ? reviewBg : `linear-gradient(135deg, ${bgStops})`,
    borderLeft: '4px solid transparent',
    borderImage: `${accentStops} 1`,
    paddingLeft: 8,
  };
}

function DateInputWithShortcuts({ value, onChange, shortcuts }) {
  return (
    <div className="date-with-shortcuts">
      <input className="date" type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} />
      {shortcuts?.length > 0 && (
        <div className="date-shortcut-row">
          {shortcuts.map(s => {
            const isActive = value === s.date;
            return (
              <button
                key={s.id}
                type="button"
                className={`date-shortcut${isActive ? ' on' : ''}`}
                onClick={() => onChange(s.date)}
                title={s.date}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShortcutsModal({ shortcuts, onCreate, onUpdate, onDelete, onClose }) {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const submit = (e) => {
    e.preventDefault();
    if (!label.trim() || !date) return;
    onCreate({ label: label.trim(), date });
    setLabel(''); setDate('');
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-narrow" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Date shortcuts</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-section">
            <label className="modal-label">Add a new shortcut</label>
            <form className="shortcut-add" onSubmit={submit}>
              <input
                className="input"
                type="text"
                placeholder="Label (e.g. First day of school)"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
              <input className="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-small" disabled={!label.trim() || !date}>Add</button>
            </form>
          </div>
          <div className="shortcuts-section">
            <label className="modal-label">
              Existing shortcuts {shortcuts.length > 0 && <span className="modal-label-count">({shortcuts.length})</span>}
            </label>
            {shortcuts.length === 0 ? (
              <p className="modal-q-empty">No shortcuts yet. Add some above.</p>
            ) : (
              <div className="shortcut-list">
                {shortcuts.map(s => (
                  <ShortcutRow key={s.id} shortcut={s} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut, onUpdate, onDelete }) {
  const [label, setLabel] = useState(shortcut.label);
  const [date, setDate] = useState(shortcut.date);
  const saveLabel = () => {
    if (label.trim() && label !== shortcut.label) onUpdate(shortcut.id, { label: label.trim() });
    else setLabel(shortcut.label);
  };
  const saveDate = () => {
    if (date && date !== shortcut.date) onUpdate(shortcut.id, { date });
    else setDate(shortcut.date);
  };
  return (
    <div className="shortcut-row">
      <input
        className="input"
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={saveLabel}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      />
      <input
        className="date"
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        onBlur={saveDate}
      />
      <button className="btn btn-ghost btn-small" onClick={() => onDelete(shortcut.id)}>Delete</button>
    </div>
  );
}

function AutoTextarea({ value, onChange, onBlur, placeholder, minHeight = 48 }) {
  const ref = useRef(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px';
  };
  useEffect(() => { resize(); }, [value]);
  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return (
    <textarea
      ref={ref}
      className="auto-grow"
      placeholder={placeholder}
      value={value}
      onChange={e => { onChange(e); requestAnimationFrame(resize); }}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

// ─── Login & chrome ───────────────────────────────────────────────────────────

function Login() {
  return (
    <div className="login-screen">
      <div className="login-mark"><Mark size={56} /></div>
      <h1>charliework<span className="dot">.</span></h1>
      <p>A calm place for your work. Sign in to continue.</p>
      <a className="btn btn-primary" href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/auth/login`}>
        Sign in with Google
      </a>
    </div>
  );
}

function CharlieModal({ onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="charlie-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="charlie-modal" onClick={e => e.stopPropagation()}>
        <img src={CHARLIE_IMG} alt="Charlie in cleaning gear" referrerPolicy="no-referrer" />
        <div className="caption">
          <span>Charlie Work</span>
          <button className="btn btn-ghost btn-small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ me, theme, onToggleTheme, onSignOut, onOpenShortcuts, onOpenMembers }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const initial = (me.email || '?').charAt(0);
  return (
    <div className="who" ref={ref}>
      <button className="who-trigger" onClick={() => setOpen(v => !v)} aria-label="Account menu" aria-expanded={open}>
        {me.avatar
          ? <img src={me.avatar} alt="" referrerPolicy="no-referrer" />
          : <span className="who-fallback">{initial}</span>}
      </button>
      {open && (
        <div className="who-menu" role="menu">
          <div className="who-email">{me.email}</div>
          <div className="who-handle">Signed in as {me.handle}</div>
          <label className="theme-toggle">
            <input type="checkbox" checked={theme === 'dark'} onChange={onToggleTheme} />
            Dark mode
          </label>
          <button className="menu-btn" onClick={onOpenShortcuts}>Date shortcuts…</button>
          <button className="menu-btn" onClick={onOpenMembers}>Manage team…</button>
          <button className="menu-btn danger" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

// ─── Task composer ────────────────────────────────────────────────────────────

function Composer({ assignees, defaultAssignee, onCreate, shortcuts }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState(defaultAssignee);
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');
  const [someday, setSomeday] = useState(false);
  const [showExtras, setShowExtras] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), notes, assignee, due_date: dueDate || null, category: category || null, tier: someday ? 'someday' : 'normal' });
    setTitle(''); setNotes(''); setAssignee(defaultAssignee); setDueDate(''); setCategory(''); setSomeday(false);
    setShowExtras(false);
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <input className="input" type="text" placeholder="Add a task" value={title} onChange={e => setTitle(e.target.value)} />
        <button type="submit" className="btn btn-primary">Add task</button>
      </div>
      {showExtras && (
        <>
          <AutoTextarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} minHeight={56} onBlur={() => {}} />
          <div className="extras">
            <select className="select" value={assignee} onChange={e => setAssignee(e.target.value)}>
              {assignees.map(a => <option key={a.value} value={a.value}>For {a.label}</option>)}
            </select>
          </div>
          <DateInputWithShortcuts value={dueDate} onChange={v => setDueDate(v || '')} shortcuts={shortcuts} />
          <div className="extras-cat">
            <span className="modal-label">Categories</span>
            <CategoryChipPicker value={category} onChange={v => setCategory(v || '')} />
          </div>
          <label className="someday-toggle">
            <input type="checkbox" checked={someday} onChange={e => setSomeday(e.target.checked)} />
            <span>Someday — explore idea, not required</span>
          </label>
        </>
      )}
      <button type="button" className="btn btn-ghost btn-small toggle-extras" onClick={() => setShowExtras(!showExtras)}>
        {showExtras ? 'Less' : 'Notes, assignee, category, due date'}
      </button>
    </form>
  );
}

// ─── Compact task card ────────────────────────────────────────────────────────

function TaskCard({ task, member, linkedOpenCount, subtaskCount = 0, subtaskCollapsed, onToggleSubtasks, onAddSubtask, onToggleComplete, onSelect, onPin, onToggleReview, onToggleSubtaskWait, dragging, dragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const hasNotes = !!(task.notes || task.additional_notes);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const catStyle = buildCategoryStyle(task.category, dark, !!task.awaiting_review);
  return (
    <div
      style={catStyle}
      className={`task${task.status === 'done' ? ' done' : ''}${task.pinned ? ' pinned' : ''}${dragging ? ' dragging' : ''}${dragOver ? ' drag-over' : ''}${task.awaiting_review ? ' awaiting-review' : ''}${task.awaiting_subtask ? ' awaiting-subtask' : ''}${parseCats(task.category).length > 1 ? ' task-multi-cat' : ''}`}
      draggable={task.status === 'open'}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="drag-handle" aria-hidden="true"><DragIcon size={14} /></div>

      <span
        className={`check${task.status === 'done' ? ' checked' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleComplete(); }}
        role="checkbox"
        aria-checked={task.status === 'done'}
        tabIndex={0}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleComplete(); } }}
      />

      <div className="task-main" onClick={onSelect}>
        <span className="title-text">{task.title}</span>
        <div className="chips">
          {task.pinned && <span className="badge badge-pin"><span className="pip" />Pinned</span>}
          {task.awaiting_review && <span className="badge badge-review">Pending review</span>}
          {task.awaiting_subtask && <span className="badge badge-blocked">Waiting on subtask</span>}
          <StatusBadge task={task} />
          {task.due_date && <span className="badge badge-neutral badge-due">Due {fmtDateShort(task.due_date)}</span>}
          <AssigneeBadge handle={task.assignee} />
          {member && <MemberChip member={member} />}
          <CategoryBadges category={task.category} />
          {hasNotes && <span className="badge badge-neutral" title="Has notes" style={{ padding: '3px 7px' }}><NoteIcon /></span>}
          {linkedOpenCount > 0 && (
            <span className="badge badge-q" title={`${linkedOpenCount} question${linkedOpenCount !== 1 ? 's' : ''} for Supervisor`}>
              <QuestionIcon /> {linkedOpenCount}
            </span>
          )}
        </div>
      </div>

      <div className="head-actions">
        {subtaskCount > 0 && (
          <button
            className={`subtask-toggle${subtaskCollapsed ? ' collapsed' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSubtasks?.(); }}
            title={subtaskCollapsed ? `Show ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}` : 'Hide subtasks'}
            aria-label="Toggle subtasks"
          >
            <ChevronDownSmall /> <span className="subtask-count">{subtaskCount}</span>
          </button>
        )}
        {onAddSubtask && (
          <button
            className="add-subtask-btn"
            onClick={e => { e.stopPropagation(); onAddSubtask(); }}
            title="Add subtask (inherits this task's category, date, assignee)"
            aria-label="Add subtask"
          >
            +
          </button>
        )}
        <button
          className={`review-btn${task.awaiting_review ? ' on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleReview(); }}
          title={task.awaiting_review ? 'Mark as fully done — clear review flag' : 'My part is done — pending review'}
          aria-label={task.awaiting_review ? 'Clear pending review' : 'Mark pending review'}
        >
          <ReviewIcon filled={!!task.awaiting_review} />
        </button>
        {onToggleSubtaskWait && (
          <button
            className={`blocked-btn${task.awaiting_subtask ? ' on' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSubtaskWait(); }}
            title={task.awaiting_subtask ? 'Clear blocked flag' : 'Blocked — waiting on a subtask'}
            aria-label="Toggle blocked"
          >
            <BlockedIcon filled={!!task.awaiting_subtask} />
          </button>
        )}
        <button
          className={`pin-btn${task.pinned ? ' on' : ''}`}
          onClick={e => { e.stopPropagation(); onPin(); }}
          title={task.pinned ? 'Unpin' : 'Pin'}
          aria-label={task.pinned ? 'Unpin' : 'Pin'}
        >
          <PinIcon filled={!!task.pinned} />
        </button>
      </div>
    </div>
  );
}

// ─── Subtask card ─────────────────────────────────────────────────────────────

function SubtaskCard({ task, member, editing, hasChildren, childCount = 0, collapsed, onToggleSubtasks, onAddSubtask, onSaveTitle, onCancelEdit, onToggleComplete, onSelect, onToggleReview, onToggleSubtaskWait }) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const catStyle = buildCategoryStyle(task.category, dark, !!task.awaiting_review);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef(null);
  useEffect(() => {
    if (editing) {
      setEditTitle(task.title);
      requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    }
  }, [editing, task.title]);
  const commit = () => {
    const v = editTitle.trim();
    if (v && v !== task.title) onSaveTitle(v);
    else onCancelEdit();
  };
  return (
    <div
      style={catStyle}
      className={`task subtask${task.status === 'done' ? ' done' : ''}${task.awaiting_review ? ' awaiting-review' : ''}${task.awaiting_subtask ? ' awaiting-subtask' : ''}${parseCats(task.category).length > 1 ? ' task-multi-cat' : ''}`}
    >
      <span
        className={`check${task.status === 'done' ? ' checked' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleComplete(); }}
        role="checkbox"
        aria-checked={task.status === 'done'}
        tabIndex={0}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleComplete(); } }}
      />
      <div className="task-main" onClick={editing ? undefined : onSelect}>
        {editing ? (
          <input
            ref={inputRef}
            className="subtask-title-edit"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setEditTitle(task.title); onCancelEdit(); }
            }}
          />
        ) : (
          <span className="title-text">{task.title}</span>
        )}
        <div className="chips">
          {task.awaiting_review && <span className="badge badge-review">Pending review</span>}
          {task.awaiting_subtask && <span className="badge badge-blocked">Waiting on subtask</span>}
          <StatusBadge task={task} />
          {task.due_date && <span className="badge badge-neutral badge-due">Due {fmtDateShort(task.due_date)}</span>}
          {member && <MemberChip member={member} />}
          <CategoryBadges category={task.category} />
        </div>
      </div>
      <div className="head-actions">
        {hasChildren && childCount > 0 && (
          <button
            className={`subtask-toggle${collapsed ? ' collapsed' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSubtasks?.(); }}
            title={collapsed ? `Show ${childCount} subtask${childCount === 1 ? '' : 's'}` : 'Hide subtasks'}
            aria-label="Toggle subtasks"
          >
            <ChevronDownSmall /> <span className="subtask-count">{childCount}</span>
          </button>
        )}
        {onAddSubtask && (
          <button
            className="add-subtask-btn"
            onClick={e => { e.stopPropagation(); onAddSubtask(); }}
            title="Add subtask"
            aria-label="Add subtask"
          >
            +
          </button>
        )}
        <button
          className={`review-btn${task.awaiting_review ? ' on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleReview(); }}
          title={task.awaiting_review ? 'Clear pending review' : 'My part is done — pending review'}
          aria-label="Toggle pending review"
        >
          <ReviewIcon filled={!!task.awaiting_review} />
        </button>
        {onToggleSubtaskWait && (
          <button
            className={`blocked-btn${task.awaiting_subtask ? ' on' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSubtaskWait(); }}
            title={task.awaiting_subtask ? 'Clear blocked flag' : 'Blocked — waiting on a subtask'}
            aria-label="Toggle blocked"
          >
            <BlockedIcon filled={!!task.awaiting_subtask} />
          </button>
        )}
      </div>
    </div>
  );
}

function SubtaskTree({ parents, subtasksByParent, collapsedParents, editingSubtaskId, memberById = {}, onCardActions }) {
  if (!parents || parents.length === 0) return null;
  return (
    <div className="subtask-group">
      {parents.map(s => {
        const kids = (subtasksByParent[s.id] || []).filter(c => c.status === 'open');
        const collapsed = collapsedParents.has(s.id);
        return (
          <React.Fragment key={s.id}>
            <SubtaskCard
              task={s}
              member={memberById[s.assignee_member_id]}
              editing={editingSubtaskId === s.id}
              hasChildren={kids.length > 0}
              childCount={kids.length}
              collapsed={collapsed}
              {...onCardActions(s)}
            />
            {kids.length > 0 && !collapsed && (
              <SubtaskTree
                parents={kids}
                subtasksByParent={subtasksByParent}
                collapsedParents={collapsedParents}
                editingSubtaskId={editingSubtaskId}
                memberById={memberById}
                onCardActions={onCardActions}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SubtaskComposerInline({ parentId, onCreate }) {
  const [title, setTitle] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), parent_id: parentId });
    setTitle('');
  };
  return (
    <form className="subtask-add" onSubmit={submit}>
      <input
        className="input"
        type="text"
        placeholder="Add subtask…"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <button type="submit" className="btn btn-secondary btn-small" disabled={!title.trim()}>Add</button>
    </form>
  );
}

// ─── Team / members ───────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 28 }) {
  if (!member) return null;
  if (member.avatar_url) {
    return <img className="member-avatar" src={member.avatar_url} alt={member.label} style={{ width: size, height: size }} />;
  }
  const initial = (member.label || '?').charAt(0).toUpperCase();
  return (
    <span className="member-avatar member-avatar-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}

function MemberChip({ member }) {
  if (!member) return null;
  return (
    <span className="badge badge-member" title={member.role || member.label}>
      <MemberAvatar member={member} size={14} />
      {member.label}
    </span>
  );
}

function MemberPicker({ value, members, onChange, includeNone = true, placeholder = 'No member' }) {
  return (
    <select className="select" value={value || ''} onChange={e => onChange(e.target.value || null)}>
      {includeNone && <option value="">{placeholder}</option>}
      {members.filter(m => m.active || m.id === value).map(m => (
        <option key={m.id} value={m.id}>{m.label}{m.active ? '' : ' (inactive)'}</option>
      ))}
    </select>
  );
}

function MembersModal({ members, onCreate, onUpdate, onDelete, onClose }) {
  const [label, setLabel] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const submit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    onCreate({ label: label.trim(), role: role.trim(), email: email.trim() });
    setLabel(''); setRole(''); setEmail('');
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-narrow" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Team members</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-section">
            <label className="modal-label">Add a member</label>
            <form className="shortcut-add" onSubmit={submit}>
              <input className="input" type="text" placeholder="Name (required)" value={label} onChange={e => setLabel(e.target.value)} />
              <input className="input" type="text" placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
              <input className="input" type="text" placeholder="Email (informational)" value={email} onChange={e => setEmail(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-small" disabled={!label.trim()}>Add</button>
            </form>
          </div>
          <div className="shortcuts-section">
            <label className="modal-label">
              Members {members.length > 0 && <span className="modal-label-count">({members.filter(m => m.active).length} active, {members.filter(m => !m.active).length} inactive)</span>}
            </label>
            {members.length === 0 ? (
              <p className="modal-q-empty">No members yet. Add some above.</p>
            ) : (
              <div className="shortcut-list">
                {members.map(m => (
                  <MemberRow key={m.id} member={m} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, onUpdate, onDelete }) {
  const [label, setLabel] = useState(member.label);
  const [role, setRole] = useState(member.role || '');
  const [email, setEmail] = useState(member.email || '');
  const saveLabel = () => {
    if (label.trim() && label !== member.label) onUpdate(member.id, { label: label.trim() });
    else setLabel(member.label);
  };
  const saveRole = () => {
    if (role !== (member.role || '')) onUpdate(member.id, { role });
  };
  const saveEmail = () => {
    if (email !== (member.email || '')) onUpdate(member.id, { email });
  };
  return (
    <div className={`shortcut-row member-row${!member.active ? ' inactive' : ''}`}>
      <MemberAvatar member={member} size={28} />
      <input className="input" type="text" value={label} onChange={e => setLabel(e.target.value)} onBlur={saveLabel} placeholder="Name" />
      <input className="input" type="text" value={role} onChange={e => setRole(e.target.value)} onBlur={saveRole} placeholder="Role" />
      <input className="input" type="text" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveEmail} placeholder="Email" />
      <button
        className={`btn btn-ghost btn-small${member.active ? '' : ' on'}`}
        onClick={() => onUpdate(member.id, { active: !member.active })}
        title={member.active ? 'Deactivate' : 'Reactivate'}
      >
        {member.active ? 'Active' : 'Inactive'}
      </button>
      <button className="btn btn-ghost btn-small" onClick={() => onDelete(member.id)}>Delete</button>
    </div>
  );
}

function MemberQuestionOptions({ question, onAnswer }) {
  const opts = Array.isArray(question.options) ? question.options : [];
  if (!opts.length) return null;
  return (
    <div className="mq-options">
      {opts.map((o, i) => {
        const isRec = question.recommended_option === i;
        const isSel = question.selected_option === i;
        return (
          <button
            key={i}
            type="button"
            className={`mq-option${isRec ? ' recommended' : ''}${isSel ? ' selected' : ''}`}
            onClick={() => onAnswer(i, o)}
          >
            {isRec && <span className="mq-rec-flag">★</span>}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TeamView({ members, memberQuestions, tasks, selectedMemberId, onSelectMember, onUpdateMemberQ, onDeleteMemberQ, onOpenManage, onSelectTask }) {
  const selected = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;
  const memberTasks = selected ? tasks.filter(t => t.assignee_member_id === selected.id) : [];
  const memberQs = selected ? memberQuestions.filter(q => q.member_id === selected.id) : [];
  const openTasks = memberTasks.filter(t => t.status === 'open');
  const doneTasks = memberTasks.filter(t => t.status === 'done');
  const pendingReview = openTasks.filter(t => t.awaiting_review);
  const openQs = memberQs.filter(q => q.status === 'open');
  const answeredQs = memberQs.filter(q => q.status === 'answered');

  return (
    <div className="team-view">
      <div className="team-toolbar">
        <button className="btn btn-secondary btn-small" onClick={onOpenManage}>Manage team…</button>
      </div>
      <div className="team-grid-wrap">
        <div className="team-grid">
          {members.filter(m => m.active).length === 0 ? (
            <div className="empty">No team members yet. Click <em>Manage team…</em> to add some.</div>
          ) : (
            members.filter(m => m.active).map(m => {
              const tCount = tasks.filter(t => t.assignee_member_id === m.id && t.status === 'open').length;
              const qCount = memberQuestions.filter(q => q.member_id === m.id && q.status === 'open').length;
              const isSel = selectedMemberId === m.id;
              return (
                <button
                  key={m.id}
                  className={`team-card${isSel ? ' selected' : ''}`}
                  onClick={() => onSelectMember(isSel ? null : m.id)}
                >
                  <MemberAvatar member={m} size={48} />
                  <div className="team-card-body">
                    <div className="team-card-name">{m.label}</div>
                    {m.role && <div className="team-card-role">{m.role}</div>}
                    <div className="team-card-stats">
                      <span>{tCount} open</span>
                      {qCount > 0 && <span className="q-count">{qCount} Q</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        {selected && (
          <div className="team-detail">
            <div className="team-detail-header">
              <MemberAvatar member={selected} size={40} />
              <div>
                <h3>{selected.label}</h3>
                {selected.role && <p className="team-detail-role">{selected.role}</p>}
              </div>
              <button className="modal-close" onClick={() => onSelectMember(null)} aria-label="Close"><CloseIcon /></button>
            </div>

            {pendingReview.length > 0 && (
              <div className="team-detail-section">
                <h4>Pending your review ({pendingReview.length})</h4>
                {pendingReview.map(t => (
                  <button key={t.id} className="team-task-row" onClick={() => onSelectTask(t.id)}>
                    {t.title}
                  </button>
                ))}
              </div>
            )}

            <div className="team-detail-section">
              <h4>Open tasks ({openTasks.length - pendingReview.length})</h4>
              {openTasks.filter(t => !t.awaiting_review).length === 0 ? (
                <p className="modal-q-empty">No open tasks.</p>
              ) : (
                openTasks.filter(t => !t.awaiting_review).map(t => (
                  <button key={t.id} className="team-task-row" onClick={() => onSelectTask(t.id)}>
                    {t.title}
                  </button>
                ))
              )}
            </div>

            <div className="team-detail-section">
              <h4>Questions from {selected.label} ({openQs.length})</h4>
              {openQs.length === 0 && answeredQs.length === 0 ? (
                <p className="modal-q-empty">No questions yet.</p>
              ) : (
                <>
                  {openQs.map(q => (
                    <div key={q.id} className="modal-q-row">
                      <span
                        className="check"
                        onClick={() => onUpdateMemberQ(q.id, { status: 'answered' })}
                        role="checkbox"
                        aria-checked={false}
                        tabIndex={0}
                      />
                      <div className="modal-q-body">
                        <span className="modal-q-text">{q.body}</span>
                        {q.task_title && <span className="modal-q-task-link" onClick={() => onSelectTask(q.task_id)}>→ {q.task_title}</span>}
                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          <MemberQuestionOptions
                            question={q}
                            onAnswer={(i, text) => onUpdateMemberQ(q.id, { status: 'answered', selected_option: i, answer: text })}
                          />
                        ) : (
                          <MemberQAnswerForm question={q} onSubmit={(answer) => onUpdateMemberQ(q.id, { status: 'answered', answer })} />
                        )}
                        <button className="btn btn-ghost btn-small" onClick={() => onDeleteMemberQ(q.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {answeredQs.length > 0 && (
                    <div className="modal-q-answered-group">
                      {answeredQs.map(q => (
                        <div key={q.id} className="modal-q-row modal-q-answered">
                          <span
                            className="check checked"
                            onClick={() => onUpdateMemberQ(q.id, { status: 'open' })}
                            role="checkbox"
                            aria-checked={true}
                            tabIndex={0}
                            title="Re-open"
                          />
                          <div className="modal-q-body">
                            <span className="modal-q-text">{q.body}</span>
                            {q.answer && <span className="modal-q-answer-text">{q.answer}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="team-detail-section team-detail-meta">
              <span>{doneTasks.length} completed</span>
              {selected.email && <span>· {selected.email}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberQAnswerForm({ question, onSubmit }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="modal-q-answer-row">
      <input
        className="input"
        placeholder="Answer…"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) onSubmit(draft); }}
      />
      <button
        className="btn btn-secondary btn-small"
        onClick={() => onSubmit(draft)}
        disabled={!draft.trim()}
      >
        Answer
      </button>
    </div>
  );
}

function TaskIntakeSection({ task, members, intakeQuestions, onCreate, onUpdate, onDelete }) {
  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const [body, setBody] = useState('');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [recommended, setRecommended] = useState('');
  useEffect(() => {
    if (!memberId && members.length) setMemberId(members[0].id);
  }, [members, memberId]);
  const openIntake = intakeQuestions.filter(q => q.status === 'open');
  const answeredIntake = intakeQuestions.filter(q => q.status === 'answered');
  const submit = (e) => {
    e.preventDefault();
    if (!body.trim() || !memberId) return;
    const opts = optionsRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const rec = recommended === '' ? null : parseInt(recommended, 10);
    onCreate({
      member_id: memberId,
      task_id: task.id,
      body: body.trim(),
      options: opts.length ? opts : null,
      recommended_option: opts.length && !Number.isNaN(rec) ? rec : null,
    });
    setBody(''); setOptionsRaw(''); setRecommended('');
  };

  return (
    <div className="modal-section modal-intake">
      <div className="modal-q-title">
        <span>Intake from member</span>
        {openIntake.length > 0 && <span className="q-count">{openIntake.length}</span>}
      </div>
      {openIntake.length === 0 && answeredIntake.length === 0 && (
        <p className="modal-q-empty">No member questions on this task.</p>
      )}
      {openIntake.map(q => (
        <div key={q.id} className="modal-q-row">
          <span
            className="check"
            onClick={() => onUpdate(q.id, { status: 'answered' })}
            role="checkbox"
            aria-checked={false}
            tabIndex={0}
          />
          <div className="modal-q-body">
            <div className="modal-q-text">
              <strong>{q.member_label || 'Member'}: </strong>{q.body}
            </div>
            {Array.isArray(q.options) && q.options.length > 0 ? (
              <MemberQuestionOptions
                question={q}
                onAnswer={(i, text) => onUpdate(q.id, { status: 'answered', selected_option: i, answer: text })}
              />
            ) : (
              <MemberQAnswerForm question={q} onSubmit={(answer) => onUpdate(q.id, { status: 'answered', answer })} />
            )}
            <button className="btn btn-ghost btn-small" onClick={() => onDelete(q.id)}>Delete</button>
          </div>
        </div>
      ))}
      {answeredIntake.length > 0 && (
        <div className="modal-q-answered-group">
          {answeredIntake.map(q => (
            <div key={q.id} className="modal-q-row modal-q-answered">
              <span
                className="check checked"
                onClick={() => onUpdate(q.id, { status: 'open' })}
                role="checkbox"
                aria-checked={true}
                tabIndex={0}
                title="Re-open"
              />
              <div className="modal-q-body">
                <span className="modal-q-text"><strong>{q.member_label || 'Member'}: </strong>{q.body}</span>
                {q.answer && <span className="modal-q-answer-text">{q.answer}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {members.length > 0 && (
        <form className="modal-q-compose modal-intake-compose" onSubmit={submit}>
          <select className="select" value={memberId} onChange={e => setMemberId(e.target.value)}>
            {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input
            className="input"
            placeholder="Log a question from this member…"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={!body.trim() || !memberId}>Log</button>
        </form>
      )}
    </div>
  );
}

// ─── Task modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, assignees, linkedQuestions, shortcuts, subtasks, members, intakeQuestions, onClose, onUpdate, onDelete, onCreateSubtask, onSelectSubtask, onCreateQuestion, onUpdateQuestion, onCreateMemberQ, onUpdateMemberQ, onDeleteMemberQ }) {
  const [title, setTitle] = useState(task.title);
  const [editTitle, setEditTitle] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');
  const [notesMode, setNotesMode] = useState('write');
  const [qBody, setQBody] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});

  useEffect(() => { setTitle(task.title); }, [task.title]);
  useEffect(() => { setNotes(task.notes || ''); }, [task.notes]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const openQs = linkedQuestions.filter(q => q.status === 'open');
  const answeredQs = linkedQuestions.filter(q => q.status === 'answered');

  const saveTitle = () => {
    setEditTitle(false);
    if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
    else setTitle(task.title);
  };
  const saveNotes = () => { if (notes !== (task.notes || '')) onUpdate(task.id, { notes }); };

  const submitQ = (e) => {
    e.preventDefault();
    if (!qBody.trim()) return;
    onCreateQuestion({ body: qBody.trim(), task_id: task.id });
    setQBody('');
  };

  const toggleQ = (q) => {
    const draft = answerDrafts[q.id];
    onUpdateQuestion(q.id, {
      status: q.status === 'answered' ? 'open' : 'answered',
      ...(q.status !== 'answered' && draft?.trim() ? { answer: draft } : {}),
    });
  };

  const submitAnswer = (q) => {
    const draft = answerDrafts[q.id] || '';
    if (!draft.trim()) return;
    onUpdateQuestion(q.id, { status: 'answered', answer: draft });
    setAnswerDrafts(d => ({ ...d, [q.id]: '' }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        <div className="modal-header">
          {editTitle ? (
            <input
              className="modal-title-edit"
              value={title}
              autoFocus
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitle(task.title); setEditTitle(false); }
              }}
            />
          ) : (
            <h2 className={`modal-title${task.status === 'done' ? ' done' : ''}`} onClick={() => setEditTitle(true)}>
              {task.title}
            </h2>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <div className="modal-cols">

          {/* ── Left: task detail ── */}
          <div className="modal-detail">
            <div className="modal-row">
              <div className="modal-field">
                <label className="modal-label">Assignee</label>
                <select className="select" value={task.assignee} onChange={e => onUpdate(task.id, { assignee: e.target.value })}>
                  {assignees.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Due date</label>
                <DateInputWithShortcuts value={task.due_date} onChange={v => onUpdate(task.id, { due_date: v })} shortcuts={shortcuts} />
              </div>
            </div>

            <div className="modal-section">
              <label className="modal-label">Categories</label>
              <CategoryChipPicker value={task.category} onChange={v => onUpdate(task.id, { category: v })} />
            </div>

            {members && members.length > 0 && (
              <div className="modal-section">
                <label className="modal-label">Assigned to member</label>
                <MemberPicker
                  value={task.assignee_member_id}
                  members={members}
                  onChange={(id) => onUpdate(task.id, { assignee_member_id: id })}
                  placeholder="— None —"
                />
              </div>
            )}

            {members && members.length > 0 && (
              <TaskIntakeSection
                task={task}
                members={members}
                intakeQuestions={intakeQuestions || []}
                onCreate={onCreateMemberQ}
                onUpdate={onUpdateMemberQ}
                onDelete={onDeleteMemberQ}
              />
            )}

            <div className="modal-section">
              <div className="modal-q-title">
                <span>For Supervisor</span>
                {openQs.length > 0 && <span className="q-count">{openQs.length}</span>}
              </div>
              {openQs.length === 0 && answeredQs.length === 0 && (
                <p className="modal-q-empty">No questions yet. Queue one below.</p>
              )}
              {openQs.map(q => (
                <div key={q.id} className="modal-q-row">
                  <span
                    className="check"
                    onClick={() => toggleQ(q)}
                    role="checkbox"
                    aria-checked={false}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleQ(q); } }}
                  />
                  <div className="modal-q-body">
                    <span className="modal-q-text">{q.body}</span>
                    <div className="modal-q-answer-row">
                      <input
                        className="input"
                        placeholder="Answer…"
                        value={answerDrafts[q.id] || ''}
                        onChange={e => setAnswerDrafts(d => ({ ...d, [q.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') submitAnswer(q); }}
                      />
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => submitAnswer(q)}
                        disabled={!answerDrafts[q.id]?.trim()}
                      >
                        Answer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {answeredQs.length > 0 && (
                <div className="modal-q-answered-group">
                  {answeredQs.map(q => (
                    <div key={q.id} className="modal-q-row modal-q-answered">
                      <span
                        className="check checked"
                        onClick={() => toggleQ(q)}
                        role="checkbox"
                        aria-checked={true}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleQ(q); } }}
                        title="Re-open"
                      />
                      <div className="modal-q-body">
                        <span className="modal-q-text">{q.body}</span>
                        {q.answer && <span className="modal-q-answer-text">{q.answer}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <form className="modal-q-compose" onSubmit={submitQ}>
                <input
                  className="input"
                  placeholder="Ask Supervisor about this…"
                  value={qBody}
                  onChange={e => setQBody(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-small" disabled={!qBody.trim()}>Ask</button>
              </form>
            </div>

            {!task.parent_id && (
              <div className="modal-section">
                <label className="modal-label">
                  Subtasks {subtasks?.length > 0 && <span className="modal-label-count">({subtasks.filter(s => s.status === 'open').length} open, {subtasks.filter(s => s.status === 'done').length} done)</span>}
                </label>
                <SubtaskComposerInline parentId={task.id} onCreate={onCreateSubtask} />
                {subtasks?.length > 0 && (
                  <div className="modal-subtask-list">
                    {subtasks.map(s => (
                      <div key={s.id} className={`modal-subtask-row${s.status === 'done' ? ' done' : ''}${s.awaiting_review ? ' awaiting-review' : ''}`}>
                        <span
                          className={`check${s.status === 'done' ? ' checked' : ''}`}
                          onClick={() => onUpdate(s.id, { status: s.status === 'done' ? 'open' : 'done' })}
                          role="checkbox"
                          aria-checked={s.status === 'done'}
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onUpdate(s.id, { status: s.status === 'done' ? 'open' : 'done' }); } }}
                        />
                        <span className="modal-subtask-title" onClick={() => onSelectSubtask(s.id)}>{s.title}</span>
                        {s.awaiting_review && <span className="badge badge-review">Pending review</span>}
                        {s.due_date && <span className="badge badge-neutral">{fmtDateShort(s.due_date)}</span>}
                        <CategoryBadges category={s.category} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-stamp">
              {task.created_by_email} · {new Date(task.created_at * 1000).toLocaleString()}
              {task.completed_at && ` · Done ${new Date(task.completed_at * 1000).toLocaleString()}`}
            </div>

            <div className="modal-footer-row">
              <button
                className={`btn btn-ghost btn-small pin-text-btn${task.pinned ? ' on' : ''}`}
                onClick={() => onUpdate(task.id, { pinned: !task.pinned })}
              >
                <PinIcon filled={!!task.pinned} />
                {task.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                className={`btn btn-ghost btn-small${task.tier === 'someday' ? ' on' : ''}`}
                onClick={() => onUpdate(task.id, { tier: task.tier === 'someday' ? 'normal' : 'someday' })}
                title={task.tier === 'someday' ? 'Promote to active' : 'Move to Someday'}
              >
                {task.tier === 'someday' ? 'Promote to active' : 'Move to Someday'}
              </button>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-danger btn-small"
                onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); } }}
              >
                Delete
              </button>
            </div>
          </div>

          {/* ── Right: Notes (Markdown) ── */}
          <div className="modal-notes-pane">
            <div className="modal-notes-header">
              <span className="modal-notes-title">Notes</span>
              <div className="modal-notes-tabs">
                <button
                  className={`mini-tab${notesMode === 'write' ? ' active' : ''}`}
                  onClick={() => setNotesMode('write')}
                >Write</button>
                <button
                  className={`mini-tab${notesMode === 'preview' ? ' active' : ''}`}
                  onClick={() => { saveNotes(); setNotesMode('preview'); }}
                >Preview</button>
              </div>
            </div>
            {notesMode === 'write' ? (
              <textarea
                className="modal-notes-textarea"
                placeholder={'Notes — supports **markdown**\n\n- bullets\n- [links](url)\n- `code`\n- # headings'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
              />
            ) : (
              <div className="modal-notes-preview markdown">
                {notes.trim()
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                  : <span className="modal-notes-empty">No notes yet. Switch to Write to add some.</span>}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Questions tab ────────────────────────────────────────────────────────────

function QuestionComposer({ tasks, onCreate }) {
  const [body, setBody] = useState('');
  const [taskId, setTaskId] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    onCreate({ body: body.trim(), task_id: taskId || null });
    setBody(''); setTaskId('');
  };

  const openTasks = tasks.filter(t => t.status === 'open');

  return (
    <form className="q-composer" onSubmit={submit}>
      <div className="composer-row">
        <input className="input" placeholder="Queue a question for Supervisor…" value={body} onChange={e => setBody(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!body.trim()}>Ask</button>
      </div>
      <select className="select" value={taskId} onChange={e => setTaskId(e.target.value)}>
        <option value="">No task link</option>
        {openTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </form>
  );
}

function QuestionItem({ q, onUpdate, onDelete }) {
  const [answerDraft, setAnswerDraft] = useState('');

  const toggle = () => {
    onUpdate(q.id, {
      status: q.status === 'answered' ? 'open' : 'answered',
      ...(q.status !== 'answered' && answerDraft.trim() ? { answer: answerDraft } : {}),
    });
    if (q.status !== 'answered') setAnswerDraft('');
  };

  const submitAnswer = () => {
    if (!answerDraft.trim()) return;
    onUpdate(q.id, { status: 'answered', answer: answerDraft });
    setAnswerDraft('');
  };

  return (
    <div className={`q-item${q.status === 'answered' ? ' q-answered' : ''}`}>
      <div className="q-head">
        <span
          className={`check${q.status === 'answered' ? ' checked' : ''}`}
          onClick={toggle}
          role="checkbox"
          aria-checked={q.status === 'answered'}
          tabIndex={0}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }}
        />
        <div className="q-body">
          <span className="q-text">{q.body}</span>
          {q.task_title && <span className="q-task-link">→ {q.task_title}</span>}
          {q.status === 'answered' && q.answer && (
            <span className="q-answer-text">{q.answer}</span>
          )}
        </div>
        <button className="btn btn-ghost btn-small" onClick={() => onDelete(q.id)}>Delete</button>
      </div>
      {q.status === 'open' && (
        <div className="q-answer-input">
          <input
            className="input"
            placeholder="Add answer…"
            value={answerDraft}
            onChange={e => setAnswerDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitAnswer(); }}
          />
          <button className="btn btn-secondary btn-small" onClick={submitAnswer} disabled={!answerDraft.trim()}>
            Answer
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionsView({ me, questions, tasks, onUpdate, onDelete, onCreate }) {
  const [qTab, setQTab] = useState('open');
  const openQs = questions.filter(q => q.status === 'open');
  const answeredQs = questions.filter(q => q.status === 'answered');
  const shown = qTab === 'open' ? openQs : answeredQs;

  return (
    <>
      <header className="header">
        <div>
          <h1>{openQs.length} pending</h1>
          <div className="sub">Questions queued for Supervisor</div>
        </div>
      </header>

      <QuestionComposer tasks={tasks} onCreate={onCreate} />

      <div className="toolbar">
        <button className={`tab${qTab === 'open' ? ' active' : ''}`} onClick={() => setQTab('open')}>
          Open <span className="count">{openQs.length}</span>
        </button>
        <button className={`tab${qTab === 'answered' ? ' active' : ''}`} onClick={() => setQTab('answered')}>
          Answered <span className="count">{answeredQs.length}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          {qTab === 'open' ? 'No open questions.' : 'No answered questions yet.'}
        </div>
      ) : (
        shown.map(q => (
          <QuestionItem key={q.id} q={q} onUpdate={onUpdate} onDelete={onDelete} />
        ))
      )}
    </>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberQuestions, setMemberQuestions] = useState([]);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [tab, setTab] = useState(() => {
    if (window.location.hash === '#questions') return 'questions';
    if (window.location.hash === '#team') return 'team';
    return 'open';
  });
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [theme, setTheme] = useState(loadTheme());
  const [showCharlie, setShowCharlie] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [collapsedParents, setCollapsedParents] = useState(() => new Set());
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);

  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      return next;
    });
  };

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    try { setTasks(await api.listTasks()); }
    catch (e) { if (e.status === 401 || e.status === 403) setMe(null); }
  }, []);

  const loadQuestions = useCallback(async () => {
    try { setQuestions(await api.listQuestions()); }
    catch (e) { if (e.status === 401 || e.status === 403) setMe(null); }
  }, []);

  const loadShortcuts = useCallback(async () => {
    try { setShortcuts(await api.listShortcuts()); }
    catch (e) { if (e.status === 401 || e.status === 403) setMe(null); }
  }, []);

  const loadMembers = useCallback(async () => {
    try { setMembers(await api.listMembers(true)); }
    catch (e) { if (e.status === 401 || e.status === 403) setMe(null); }
  }, []);

  const loadMemberQuestions = useCallback(async () => {
    try { setMemberQuestions(await api.listMemberQuestions()); }
    catch (e) { if (e.status === 401 || e.status === 403) setMe(null); }
  }, []);

  useEffect(() => { if (me) { load(); loadQuestions(); loadShortcuts(); loadMembers(); loadMemberQuestions(); } }, [me, load, loadQuestions, loadShortcuts, loadMembers, loadMemberQuestions]);

  // Scroll lock while modal is open
  useEffect(() => {
    document.body.style.overflow = selectedTaskId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedTaskId]);

  const open = useMemo(() => tasks.filter(t => !t.parent_id && t.status === 'open' && t.tier !== 'someday'), [tasks]);
  const someday = useMemo(() => tasks.filter(t => !t.parent_id && t.status === 'open' && t.tier === 'someday'), [tasks]);
  const done = useMemo(() => tasks.filter(t => !t.parent_id && t.status === 'done'), [tasks]);
  const subtasksByParent = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (t.parent_id) (map[t.parent_id] = map[t.parent_id] || []).push(t);
    }
    for (const k in map) {
      map[k].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        if (!!a.awaiting_review !== !!b.awaiting_review) return a.awaiting_review ? -1 : 1;
        return a.created_at - b.created_at;
      });
    }
    return map;
  }, [tasks]);
  const applyFilters = useCallback((list) => {
    let out = list;
    if (filter !== 'all') {
      if (filter.startsWith('m:')) {
        const mid = filter.slice(2);
        out = out.filter(t => (t.assignee_member_id || '') === (mid === '__none' ? '' : mid));
      } else {
        out = out.filter(t => t.assignee === filter);
      }
    }
    if (catFilter !== 'all') {
      out = out.filter(t => {
        const cats = parseCats(t.category);
        if (catFilter === '') return cats.length === 0;
        return cats.includes(catFilter);
      });
    }
    return out;
  }, [filter, catFilter]);
  const filteredOpen = useMemo(() => applyFilters(open), [open, applyFilters]);
  const filteredSomeday = useMemo(() => applyFilters(someday), [someday, applyFilters]);

  const qByTask = useMemo(() => {
    const map = {};
    for (const q of questions) {
      if (q.task_id) (map[q.task_id] = map[q.task_id] || []).push(q);
    }
    return map;
  }, [questions]);

  const openQCount = useMemo(() => questions.filter(q => q.status === 'open').length, [questions]);

  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const memberQByTask = useMemo(() => {
    const map = {};
    for (const q of memberQuestions) {
      if (q.task_id) (map[q.task_id] = map[q.task_id] || []).push(q);
    }
    return map;
  }, [memberQuestions]);

  const memberQCount = useMemo(() => memberQuestions.filter(q => q.status === 'open').length, [memberQuestions]);

  const selectedTask = useMemo(
    () => selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null,
    [selectedTaskId, tasks]
  );

  if (loading) return null;
  if (!me) return <Login />;

  const defaultAssignee = me.handle || me.assignees?.[0]?.value || 'together';

  // ── Task handlers ──
  const createTask = async (data) => { await api.createTask(data); load(); };
  const createSubtaskFromParent = async (parent) => {
    const created = await api.createTask({
      title: 'New subtask',
      parent_id: parent.id,
      category: parent.category || null,
      due_date: parent.due_date || null,
      assignee: parent.assignee,
      tier: parent.tier || 'normal',
    });
    setCollapsedParents(s => { const n = new Set(s); n.delete(parent.id); return n; });
    await load();
    setEditingSubtaskId(created.id);
  };
  const updateTask = async (id, data) => { await api.updateTask(id, data); load(); };
  const deleteTask = async (id) => { await api.deleteTask(id); setTasks(ts => ts.filter(t => t.id !== id)); };

  // ── Question handlers ──
  const createQuestion = async (data) => { await api.createQuestion(data); loadQuestions(); };
  const updateQuestion = async (id, data) => { await api.updateQuestion(id, data); loadQuestions(); };
  const deleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.deleteQuestion(id);
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  // ── Shortcut handlers ──
  const createShortcut = async (data) => { await api.createShortcut(data); loadShortcuts(); };
  const updateShortcut = async (id, data) => { await api.updateShortcut(id, data); loadShortcuts(); };
  const deleteShortcut = async (id) => { await api.deleteShortcut(id); setShortcuts(s => s.filter(x => x.id !== id)); };

  const createMember = async (data) => { await api.createMember(data); loadMembers(); };
  const updateMember = async (id, data) => { await api.updateMember(id, data); loadMembers(); };
  const deleteMember = async (id) => {
    if (!confirm('Delete this team member? Their tasks will be unassigned and their questions deleted.')) return;
    await api.deleteMember(id);
    setMembers(ms => ms.filter(m => m.id !== id));
    load();
    loadMemberQuestions();
  };
  const createMemberQuestion = async (data) => { await api.createMemberQuestion(data); loadMemberQuestions(); };
  const updateMemberQuestion = async (id, data) => { await api.updateMemberQuestion(id, data); loadMemberQuestions(); };
  const deleteMemberQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.deleteMemberQuestion(id);
    setMemberQuestions(qs => qs.filter(q => q.id !== id));
  };

  // ── Drag and drop ──
  const handleDragStart = (id) => setDragId(id);
  const handleDragOver = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!dragId) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }
    const dragged = tasks.find(t => t.id === dragId);
    const target = tasks.find(t => t.id === targetId);
    if (!dragged || !target) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }
    const draggedTier = dragged.tier === 'someday' ? 'someday' : 'normal';
    const targetTier = target.tier === 'someday' ? 'someday' : 'normal';

    if (draggedTier !== targetTier) {
      setDragId(null); setDragOverId(null); setDragOverZone(null);
      await api.updateTask(dragId, { tier: targetTier });
      load();
      return;
    }
    if (dragId === targetId) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }

    const baseList = draggedTier === 'someday' ? [...someday] : [...open];
    const fromIdx = baseList.findIndex(t => t.id === dragId);
    const toIdx = baseList.findIndex(t => t.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }
    const [moved] = baseList.splice(fromIdx, 1);
    baseList.splice(toIdx, 0, moved);
    const nextOpen = draggedTier === 'someday' ? open : baseList;
    const nextSomeday = draggedTier === 'someday' ? baseList : someday;
    setTasks([...nextOpen, ...nextSomeday, ...done]);
    setDragId(null); setDragOverId(null); setDragOverZone(null);
    await api.reorder([...nextOpen, ...nextSomeday].map(t => t.id));
    load();
  };
  const handleZoneDragOver = (zone) => (e) => { e.preventDefault(); setDragOverZone(zone); setDragOverId(null); };
  const handleZoneDrop = (zone) => async (e) => {
    e.preventDefault();
    if (!dragId) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }
    const dragged = tasks.find(t => t.id === dragId);
    if (!dragged) { setDragId(null); setDragOverId(null); setDragOverZone(null); return; }
    const currentTier = dragged.tier === 'someday' ? 'someday' : 'normal';
    if (currentTier !== zone) {
      setDragId(null); setDragOverId(null); setDragOverZone(null);
      await api.updateTask(dragId, { tier: zone });
      load();
    } else {
      setDragId(null); setDragOverId(null); setDragOverZone(null);
    }
  };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); setDragOverZone(null); };

  const shown = tab === 'open' ? filteredOpen : done;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <AssigneeContext.Provider value={me.assignees}>
    <div className="app">
      {showCharlie && <CharlieModal onClose={() => setShowCharlie(false)} />}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          assignees={me.assignees}
          linkedQuestions={qByTask[selectedTask.id] || []}
          shortcuts={shortcuts}
          subtasks={subtasksByParent[selectedTask.id] || []}
          members={members}
          intakeQuestions={memberQByTask[selectedTask.id] || []}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={updateTask}
          onDelete={async (id) => { await deleteTask(id); setSelectedTaskId(null); }}
          onCreateSubtask={createTask}
          onSelectSubtask={(id) => setSelectedTaskId(id)}
          onCreateQuestion={createQuestion}
          onUpdateQuestion={updateQuestion}
          onCreateMemberQ={createMemberQuestion}
          onUpdateMemberQ={updateMemberQuestion}
          onDeleteMemberQ={deleteMemberQuestion}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsModal
          shortcuts={shortcuts}
          onCreate={createShortcut}
          onUpdate={updateShortcut}
          onDelete={deleteShortcut}
          onClose={() => setShortcutsOpen(false)}
        />
      )}

      {membersModalOpen && (
        <MembersModal
          members={members}
          onCreate={createMember}
          onUpdate={updateMember}
          onDelete={deleteMember}
          onClose={() => setMembersModalOpen(false)}
        />
      )}

      <div className="topbar">
        <button className="brand" onClick={() => setShowCharlie(true)} aria-label="Open Charlie image">
          <Mark size={26} />
          <span className="brand-wm">charliework<span className="dot">.</span></span>
        </button>
        <UserMenu
          me={me}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={async () => { await api.logout(); setMe(null); }}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenMembers={() => setMembersModalOpen(true)}
        />
      </div>

      {tab !== 'questions' && tab !== 'team' && (
        <>
          <header className="header">
            <div>
              <h1>{tab === 'open' ? `${open.length} open` : `${done.length} done`}</h1>
              <div className="sub">{today} · {done.length} of {tasks.length} done</div>
            </div>
          </header>
          <Composer assignees={me.assignees} defaultAssignee={defaultAssignee} onCreate={createTask} shortcuts={shortcuts} />
        </>
      )}

      <div className="toolbar">
        <button className={`tab${tab === 'open' ? ' active' : ''}`} onClick={() => setTab('open')}>
          Open <span className="count">{open.length}</span>
        </button>
        <button className={`tab${tab === 'done' ? ' active' : ''}`} onClick={() => setTab('done')}>
          Done <span className="count">{done.length}</span>
        </button>
        <button className={`tab${tab === 'questions' ? ' active' : ''}`} onClick={() => setTab('questions')}>
          Ask Supervisor {openQCount > 0 && <span className="count">{openQCount}</span>}
        </button>
        <button className={`tab${tab === 'team' ? ' active' : ''}`} onClick={() => setTab('team')}>
          Team {memberQCount > 0 && <span className="count">{memberQCount}</span>}
        </button>
        {someday.length > 0 && tab === 'open' && (
          <span className="speculative-count" title="Someday — explore ideas">
            +{someday.length} speculative
          </span>
        )}
        <span className="spacer" />
        {tab !== 'questions' && tab !== 'team' && (
          <div className="filter-wrap">
            {tab === 'open' && (
              <>
                <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="all">Everyone</option>
                  {me.assignees.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  {members.filter(m => m.active).length > 0 && (
                    <optgroup label="Team members">
                      {members.filter(m => m.active).map(m => (
                        <option key={m.id} value={`m:${m.id}`}>{m.label}</option>
                      ))}
                      <option value="m:__none">— No member —</option>
                    </optgroup>
                  )}
                </select>
                <select className="select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  <option value="">No category</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {tab === 'team' ? (
        <TeamView
          members={members}
          memberQuestions={memberQuestions}
          tasks={tasks}
          selectedMemberId={selectedMemberId}
          onSelectMember={setSelectedMemberId}
          onUpdateMemberQ={updateMemberQuestion}
          onDeleteMemberQ={deleteMemberQuestion}
          onOpenManage={() => setMembersModalOpen(true)}
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      ) : tab === 'questions' ? (
        <QuestionsView
          me={me}
          questions={questions}
          tasks={tasks}
          onUpdate={updateQuestion}
          onDelete={deleteQuestion}
          onCreate={createQuestion}
        />
      ) : tab === 'open' ? (
        <>
          <div
            className={`normal-zone${dragOverZone === 'normal' ? ' drag-over' : ''}`}
            onDragOver={handleZoneDragOver('normal')}
            onDragLeave={() => setDragOverZone(z => z === 'normal' ? null : z)}
            onDrop={handleZoneDrop('normal')}
          >
          {shown.length === 0 && filteredSomeday.length === 0 && (
            <div className="empty">Nothing due. Add a task above.</div>
          )}
          {shown.length === 0 && filteredSomeday.length > 0 && (
            <div className="empty empty-small">No active tasks — drag one up from Someday to promote it.</div>
          )}
          {shown.map(t => {
            const linkedOpenCount = (qByTask[t.id] || []).filter(q => q.status === 'open').length;
            const subs = subtasksByParent[t.id] || [];
            const openSubs = subs.filter(s => s.status === 'open');
            const collapsed = collapsedParents.has(t.id);
            return (
              <React.Fragment key={t.id}>
                <TaskCard
                  task={t}
                  member={memberById[t.assignee_member_id]}
                  linkedOpenCount={linkedOpenCount}
                  subtaskCount={openSubs.length}
                  subtaskCollapsed={collapsed}
                  onToggleSubtasks={() => setCollapsedParents(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                  onAddSubtask={() => createSubtaskFromParent(t)}
                  onToggleComplete={() => updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
                  onSelect={() => setSelectedTaskId(t.id)}
                  onPin={() => updateTask(t.id, { pinned: !t.pinned })}
                  onToggleReview={() => updateTask(t.id, { awaiting_review: !t.awaiting_review })}
                  onToggleSubtaskWait={() => updateTask(t.id, { awaiting_subtask: !t.awaiting_subtask })}
                  dragging={dragId === t.id}
                  dragOver={dragOverId === t.id}
                  onDragStart={() => handleDragStart(t.id)}
                  onDragOver={e => handleDragOver(e, t.id)}
                  onDrop={e => handleDrop(e, t.id)}
                  onDragEnd={handleDragEnd}
                />
                {openSubs.length > 0 && !collapsed && (
                  <SubtaskTree
                    parents={openSubs}
                    subtasksByParent={subtasksByParent}
                    collapsedParents={collapsedParents}
                    editingSubtaskId={editingSubtaskId}
                    memberById={memberById}
                    onCardActions={(s) => ({
                      onToggleSubtasks: () => setCollapsedParents(set => { const n = new Set(set); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; }),
                      onAddSubtask: () => createSubtaskFromParent(s),
                      onSaveTitle: async (newTitle) => { await updateTask(s.id, { title: newTitle }); setEditingSubtaskId(null); },
                      onCancelEdit: () => setEditingSubtaskId(null),
                      onToggleComplete: () => updateTask(s.id, { status: s.status === 'done' ? 'open' : 'done' }),
                      onSelect: () => setSelectedTaskId(s.id),
                      onToggleReview: () => updateTask(s.id, { awaiting_review: !s.awaiting_review }),
                      onToggleSubtaskWait: () => updateTask(s.id, { awaiting_subtask: !s.awaiting_subtask }),
                    })}
                  />
                )}
              </React.Fragment>
            );
          })}
          </div>
          <div
            className={`someday-zone${dragOverZone === 'someday' ? ' drag-over' : ''}`}
            onDragOver={handleZoneDragOver('someday')}
            onDragLeave={() => setDragOverZone(z => z === 'someday' ? null : z)}
            onDrop={handleZoneDrop('someday')}
          >
            <div className="someday-divider">
              <span className="someday-divider-label">Someday — explore ideas</span>
              {filteredSomeday.length > 0 && <span className="someday-divider-count">{filteredSomeday.length}</span>}
            </div>
            {filteredSomeday.length === 0 ? (
              <div className="someday-empty">Drop a task here to mark it as someday — or check the box when adding.</div>
            ) : (
              filteredSomeday.map(t => {
                const linkedOpenCount = (qByTask[t.id] || []).filter(q => q.status === 'open').length;
                return (
                  <TaskCard
                    key={t.id}
                    task={t}
                  member={memberById[t.assignee_member_id]}
                    linkedOpenCount={linkedOpenCount}
                    onToggleComplete={() => updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
                    onSelect={() => setSelectedTaskId(t.id)}
                    onPin={() => updateTask(t.id, { pinned: !t.pinned })}
                onToggleReview={() => updateTask(t.id, { awaiting_review: !t.awaiting_review })}
                    dragging={dragId === t.id}
                    dragOver={dragOverId === t.id}
                    onDragStart={() => handleDragStart(t.id)}
                    onDragOver={e => handleDragOver(e, t.id)}
                    onDrop={e => handleDrop(e, t.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              })
            )}
          </div>
        </>
      ) : shown.length === 0 ? (
        <div className="empty">Nothing completed yet.</div>
      ) : (
        shown.map(t => {
          const linkedOpenCount = (qByTask[t.id] || []).filter(q => q.status === 'open').length;
          return (
            <TaskCard
              key={t.id}
              task={t}
                  member={memberById[t.assignee_member_id]}
              linkedOpenCount={linkedOpenCount}
              onToggleComplete={() => updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
              onSelect={() => setSelectedTaskId(t.id)}
              onPin={() => updateTask(t.id, { pinned: !t.pinned })}
                onToggleReview={() => updateTask(t.id, { awaiting_review: !t.awaiting_review })}
              dragging={dragId === t.id}
              dragOver={dragOverId === t.id}
              onDragStart={() => handleDragStart(t.id)}
              onDragOver={e => handleDragOver(e, t.id)}
              onDrop={e => handleDrop(e, t.id)}
              onDragEnd={handleDragEnd}
            />
          );
        })
      )}
    </div>
    </AssigneeContext.Provider>
  );
}
