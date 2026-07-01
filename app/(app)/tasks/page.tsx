import { TasksBoard } from "@/components/tasks/tasks-board";
import { getServerT } from "@/lib/i18n/server";
import { getTasks } from "@/lib/data/tasks";

export const metadata = { title: "Tasks · AEC-flow" };

export default async function TasksPage() {
  const tr = await getServerT();
  const tasks = await getTasks();
  const open = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-fg">{tr("Tasks")}</h2>
        <p className="mt-1 text-sm text-muted">
          A shared task board — {open} open of {tasks.length}. Drag cards between columns, click to edit.
        </p>
      </div>
      <TasksBoard tasks={tasks} />
    </div>
  );
}
