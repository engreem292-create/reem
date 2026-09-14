"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TeamMemberRecord = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  auth_user_id: string | null;
};

type ProjectRecord = {
  id: string;
  assigned_to: string | null;
  status_id: string | null;
  hidden: boolean;
};

type FollowUpRecord = {
  id: string;
  project_id: string;
  assigned_to: string | null;
  follow_up_date: string | null;
  completed: boolean;
};

type StatusRecord = {
  id: string;
  name: string;
};

type TeamMemberForm = {
  fullName: string;
  role: "sales" | "admin";
};

const emptyForm: TeamMemberForm = {
  fullName: "",
  role: "sales",
};

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

export default function TeamMembersSection({
  teamMembers,
  projects,
  followUps,
  statuses,
  isAdmin,
  onChanged,
}: {
  teamMembers: TeamMemberRecord[];
  projects: ProjectRecord[];
  followUps: FollowUpRecord[];
  statuses: StatusRecord[];
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<TeamMemberForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const today = getTodayString();

  const tenderStatusIds = useMemo(
    () =>
      new Set(
        statuses
          .filter((status) =>
            status.name.toLowerCase().includes("tender")
          )
          .map((status) => status.id)
      ),
    [statuses]
  );

  function getMemberStats(memberId: string) {
    const memberProjects = projects.filter(
      (project) => project.assigned_to === memberId
    );
    const memberProjectIds = new Set(
      memberProjects.map((project) => project.id)
    );

    const memberFollowUps = followUps.filter(
      (followUp) =>
        followUp.assigned_to === memberId ||
        (!followUp.assigned_to &&
          memberProjectIds.has(followUp.project_id))
    );

    return {
      activeProjects: memberProjects.filter(
        (project) => !project.hidden
      ).length,
      tenders: memberProjects.filter((project) =>
        project.status_id
          ? tenderStatusIds.has(project.status_id)
          : false
      ).length,
      overdue: memberFollowUps.filter(
        (followUp) =>
          !followUp.completed &&
          !!followUp.follow_up_date &&
          followUp.follow_up_date < today
      ).length,
      today: memberFollowUps.filter(
        (followUp) =>
          !followUp.completed &&
          followUp.follow_up_date === today
      ).length,
    };
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(member: TeamMemberRecord) {
    setEditingId(member.id);
    setForm({
      fullName: member.full_name,
      role: member.role.toLowerCase() === "admin"
        ? "admin"
        : "sales",
    });
    setError("");
    setShowForm(true);
  }

  async function saveMember(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setError("Team member name is required.");
      return;
    }

    if (!isAdmin) {
      setError("Only an admin can manage team members.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      full_name: form.fullName.trim(),
      role: form.role,
      active: true,
    };

    const result = editingId
      ? await supabase
          .from("team_members")
          .update({
            full_name: payload.full_name,
            role: payload.role,
          })
          .eq("id", editingId)
      : await supabase
          .from("team_members")
          .insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    await onChanged();
  }

  async function toggleActive(member: TeamMemberRecord) {
    if (!isAdmin) {
      setError("Only an admin can manage team members.");
      return;
    }

    setBusyId(member.id);
    setError("");

    const result = await supabase
      .from("team_members")
      .update({ active: !member.active })
      .eq("id", member.id);

    if (result.error) {
      setError(result.error.message);
      setBusyId(null);
      return;
    }

    setBusyId(null);
    await onChanged();
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Team Members</h2>
          <p className="mt-1 text-gray-500">
            Manage the sales team and review individual workloads
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
          >
            + Add Team Member
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {teamMembers.map((member) => {
          const stats = getMemberStats(member.id);

          return (
            <div
              key={member.id}
              className={
                member.active
                  ? "rounded-xl bg-white p-6 shadow-sm"
                  : "rounded-xl border border-gray-200 bg-gray-50 p-6 opacity-75"
              }
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">
                      {member.full_name}
                    </h3>
                    <span
                      className={
                        member.active
                          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600"
                      }
                    >
                      {member.active ? "Active" : "Inactive"}
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      {member.role}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    {member.auth_user_id
                      ? "Login account linked"
                      : "No login account linked"}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => toggleActive(member)}
                      className={
                        member.active
                          ? "rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                          : "rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                      }
                    >
                      {busyId === member.id
                        ? "Saving..."
                        : member.active
                          ? "Deactivate"
                          : "Activate"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Active Projects" value={stats.activeProjects} />
                <Stat label="Tenders" value={stats.tenders} />
                <Stat label="Overdue" value={stats.overdue} danger />
                <Stat label="Today" value={stats.today} />
              </div>
            </div>
          );
        })}
      </div>

      {teamMembers.length === 0 && (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-gray-500">
          No team members found.
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <h3 className="text-2xl font-bold">
                {editingId ? "Edit Team Member" : "Add Team Member"}
              </h3>
              <button
                type="button"
                onClick={() => !saving && setShowForm(false)}
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveMember} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full Name
                </label>
                <input
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fullName: event.target.value,
                    })
                  }
                  placeholder="Team member name"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as "sales" | "admin",
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-500"
                >
                  <option value="sales">Sales</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-5 py-3 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={
          danger && value > 0
            ? "mt-1 text-2xl font-bold text-red-600"
            : "mt-1 text-2xl font-bold"
        }
      >
        {value}
      </p>
    </div>
  );
}
