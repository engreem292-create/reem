     "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import TeamMembersSection from "@/app/components/TeamMembersSection";

type Page =
  | "dashboard"
  | "projects"
  | "customers"
  | "team"
  | "followups";
type ProjectView = "active" | "hidden" | "all";
type ProjectSort =
  | "created_desc"
  | "created_asc"
  | "date_desc"
  | "date_asc"
  | "name_asc"
  | "name_desc"
  | "sale_desc"
  | "sale_asc"
  | "status";

type Company = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  customer_group: "contracting_company" | "consultant_company" | "general_customer";
  general_customer_type: "company" | "person" | null;
  active: boolean;
};

type CompanyContact = {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

type CustomerContactForm = {
  id?: string;
  fullName: string;
  phone: string;
  email: string;
};

type Profile = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
};

type TeamMember = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  auth_user_id: string | null;
};

type ProjectStatus = {
  id: string;
  name: string;
  sort_order: number | null;
  active: boolean;
};

const DEFAULT_STATUSES: ProjectStatus[] = [
  {
    id: "active-in-progress",
    name: "Active/In Progress",
    sort_order: 1,
    active: true,
  },
  {
    id: "tendering",
    name: "Tendering",
    sort_order: 2,
    active: true,
  },
  {
    id: "adjusted",
    name: "Adjusted",
    sort_order: 3,
    active: true,
  },
  {
    id: "submittal",
    name: "Submittal",
    sort_order: 4,
    active: true,
  },
  {
    id: "won",
    name: "Won",
    sort_order: 5,
    active: true,
  },
  {
    id: "lost",
    name: "Lost",
    sort_order: 6,
    active: true,
  },
  {
    id: "purchase-order",
    name: "Purchase Order",
    sort_order: 7,
    active: true,
  },
  {
    id: "pricing-only",
    name: "Pricing Only",
    sort_order: 8,
    active: true,
  },
];

type Project = {
  id: string;
  sn: string | null;
  project_name: string | null;
  customer_id: string | null;
  contracting_company_id: string | null;
  contractor_id: string | null;
  consultant_id: string | null;
  contractor_name: string | null;
  consultant_name: string | null;
  mobile_no: string | null;
  project_date: string | null;
  status_id: string | null;
  estimated_sale_jd: number | null;
  estimated_cost_jd: number | null;
  assigned_to: string | null;
  prepared_by: string | null;
  prepared_by_other: string | null;
  notes: string | null;
  rejection_reason: string | null;
  specification_mismatch: string | null;
  hidden: boolean;
  created_at: string;
  updated_at: string;
};

type FollowUp = {
  id: string;
  project_id: string;
  assigned_to: string | null;
  follow_up_date: string | null;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
};

type ProjectForm = {
  sn: string;
  projectName: string;
  customerId: string;
  contractingCompanyId: string;
  contractorId: string;
  consultantId: string;
  contractorName: string;
  consultantName: string;
  mobileNo: string;
  projectDate: string;
  statusId: string;
  estimatedSaleJd: string;
  estimatedCostJd: string;
  assignedTo: string;
  preparedBy: string;
  preparedByOther: string;
  notes: string;
  rejectionReason: string;
  specificationMismatch: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  customerGroup: "contracting_company" | "consultant_company" | "general_customer";
  generalCustomerType: "company" | "person";
  contacts: CustomerContactForm[];
};

type FollowUpForm = {
  projectId: string;
  assignedTo: string;
  followUpDate: string;
  notes: string;
};

const emptyProject: ProjectForm = {
  sn: "",
  projectName: "",
  customerId: "",
  contractingCompanyId: "",
  contractorId: "",
  consultantId: "",
  contractorName: "",
  consultantName: "",
  mobileNo: "",
  projectDate: "",
  statusId: "",
  estimatedSaleJd: "",
  estimatedCostJd: "",
  assignedTo: "",
  preparedBy: "",
  preparedByOther: "",
  notes: "",
  rejectionReason: "",
  specificationMismatch: "",
};

const LOST_REASON_OPTIONS = [
  "High Price",
  "Not Awarded to Contractor",
  "Specification Mismatch",
  "Pricing Only",
  "Brand Not Approved",
  "Payment Terms",
  "Country of Origin Not Approved",
  "UGR Not Accepted",
] as const;

function normalizeStatusGroup(statusName: string) {
  const normalized = statusName.trim().toLowerCase();
  if (normalized === "won" || normalized === "awarded") return "awarded";
  if (normalized === "submittal") return "submittal stage";
  return normalized;
}

function getStatusGroupLabel(group: string) {
  if (group === "awarded") return "Awarded / Won";
  if (group === "submittal stage") return "Submittal Stage";
  return group.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const emptyCustomer: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  customerGroup: "general_customer",
  generalCustomerType: "company",
  contacts: [],
};

const emptyFollowUp: FollowUpForm = {
  projectId: "",
  assignedTo: "",
  followUpDate: "",
  notes: "",
};

const AUTOMATIC_FOLLOW_UP_DAYS: Record<string, number> = {
  active: 7,
  "active/in progress": 7,
  tendering: 30,
  submittal: 7,
};

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function addDaysToDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-GB");
}

function getStatusBadgeClass(statusName: string) {
  switch (statusName.trim().toLowerCase()) {
    case "won":
    case "awarded":
      return "bg-green-100 text-green-800 ring-green-200";
    case "lost":
      return "bg-red-100 text-red-800 ring-red-200";
    case "tendering":
      return "bg-blue-900 text-white ring-blue-900";
    case "active/in progress":
    case "active":
      return "bg-blue-100 text-blue-800 ring-blue-200";
    case "submittal":
    case "submittal stage":
      return "bg-yellow-100 text-yellow-800 ring-yellow-200";
    case "awaiting decision":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "adjusted":
      return "bg-gray-200 text-gray-700 ring-gray-300";
    case "purchase order":
      return "bg-emerald-700 text-white ring-emerald-700";
    case "new lead":
      return "bg-cyan-100 text-cyan-800 ring-cyan-200";
    case "contacted":
      return "bg-sky-100 text-sky-800 ring-sky-200";
    case "quotation sent":
      return "bg-indigo-100 text-indigo-800 ring-indigo-200";
    case "negotiation":
      return "bg-yellow-100 text-yellow-800 ring-yellow-200";
    case "pricing only":
      return "bg-slate-200 text-slate-800 ring-slate-300";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
}

function StatusBadge({ statusName }: { statusName: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${getStatusBadgeClass(statusName)}`}
    >
      {statusName}
    </span>
  );
}

export default function Home() {
const [session, setSession] = useState<any>(null);
const [checkingAuth, setCheckingAuth] = useState(true);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loginError, setLoginError] = useState("");
const [loggingIn, setLoggingIn] = useState(false);
useEffect(() => {
  let mounted = true;

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (mounted) {
      setSession(session);
      setCheckingAuth(false);
    }
  }

  checkSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []); 
const [page, setPage] = useState<Page>("dashboard");

const [followUpFilter, setFollowUpFilter] = useState<
  "all" | "open" | "today" | "overdue" | "completed"
>("all");
const [assignedToFilter, setAssignedToFilter] = useState("all");
const [projectAssignedToFilter, setProjectAssignedToFilter] =
  useState("all");
const [projectCompanyFilter, setProjectCompanyFilter] =
  useState<string | null>(null);
const [projectStatusFilter, setProjectStatusFilter] = useState("all");

  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyContacts, setCompanyContacts] = useState<CompanyContact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>(DEFAULT_STATUSES);
  const [followUps, setFollowUps] =
useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] =
    useState<string | null>(null);
  const [customerFormError, setCustomerFormError] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [error, setError] = useState("");

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalFromProject, setCustomerModalFromProject] = useState(false);
  const [customerModalProjectField, setCustomerModalProjectField] = useState<
    "customer" | "contracting" | "consultant"
  >("customer");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  const [editingProjectId, setEditingProjectId] =
    useState<string | null>(null);
  const [copyingProject, setCopyingProject] = useState(false);

  const [editingCustomerId, setEditingCustomerId] =
    useState<string | null>(null);

  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null);

  const [projectSearch, setProjectSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerGroupFilter, setCustomerGroupFilter] = useState<
    Company["customer_group"]
  >("general_customer");

  const [projectView, setProjectView] =
    useState<ProjectView>("active");

  const [projectSort, setProjectSort] =
    useState<ProjectSort>("created_desc");

  const [projectForm, setProjectForm] =
    useState<ProjectForm>(emptyProject);

  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(emptyCustomer);

  const [followUpForm, setFollowUpForm] =
    useState<FollowUpForm>(emptyFollowUp);

  async function loadData(clearExistingError = true) {
setLoading(true);
if (clearExistingError) {
setError("");
}
const {
  data: { session },
} = await supabase.auth.getSession();

console.log("SUPABASE SESSION:", session);
    const [
      projectsResult,
      companiesResult,
      companyContactsResult,
      profilesResult,
      teamMembersResult,
      statusesResult,
      followUpsResult,
    ] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,sn,project_name,customer_id,contracting_company_id,contractor_id,consultant_id,contractor_name,consultant_name,mobile_no,project_date,status_id,estimated_sale_jd,estimated_cost_jd,assigned_to,prepared_by,prepared_by_other,notes,rejection_reason,specification_mismatch,hidden,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("companies")
        .select("id,name,phone,email,notes,customer_group,general_customer_type,active")
        .order("name", { ascending: true }),

      supabase
        .from("company_contacts")
        .select("id,company_id,full_name,phone,email,active")
        .order("full_name", { ascending: true }),

      supabase
        .from("profiles")
        .select("id,full_name,role,active")
        .eq("active", true)
        .order("full_name", { ascending: true }),
      
      supabase
        .from("team_members")
        .select("id, full_name, role, active, auth_user_id")
        .order("full_name", { ascending: true }),

      supabase
        .from("project_statuses")
        .select("id,name,sort_order,active")
        .eq("active", true)
        .order("sort_order", { ascending: true }),

      supabase
        .from("follow_ups")
        .select(
          "id,project_id,assigned_to,follow_up_date,notes,completed,completed_at"
        )
        .order("follow_up_date", { ascending: true }),
    ]);

    let hasError = false;

    if (projectsResult.error) {
      console.error(projectsResult.error);
      setError("Projects: " + projectsResult.error.message);
      hasError = true;
    } else {
      setProjects((projectsResult.data || []) as Project[]);
    }

    if (companiesResult.error) {
      console.error(
  "COMPANIES ERROR:",
  companiesResult.error?.message,
  companiesResult.error
);
      setError("Companies: " + companiesResult.error.message);
      hasError = true;
    } else {
      setCompanies((companiesResult.data || []) as Company[]);
    }

    if (companyContactsResult.error) {
      console.error("COMPANY CONTACTS ERROR:", companyContactsResult.error);
      setError("Customer contacts: " + companyContactsResult.error.message);
      hasError = true;
    } else {
      setCompanyContacts((companyContactsResult.data || []) as CompanyContact[]);
    }

    if (profilesResult.error) {
      console.error(profilesResult.error);
      setError("Profiles: " + profilesResult.error.message);
      hasError = true;
    } else {
      setProfiles((profilesResult.data || []) as Profile[]);
    }
    if (teamMembersResult.error) {
  throw teamMembersResult.error;
} else {
  setTeamMembers((teamMembersResult.data || []) as TeamMember[]);
   console.log("TEAM MEMBERS:", teamMembersResult.data);
 console.log("TEAM MEMBERS ERROR:", teamMembersResult.error);

}
if (statusesResult.error) {
console.error("Could not load statuses:", statusesResult.error);
setStatuses([]);	
hasError = true;
setError("Statuses: " + statusesResult.error.message);
} else {
const databaseStatuses =
(statusesResult.data || []) as ProjectStatus[];
if (databaseStatuses.length === 0) {
setStatuses([]);
hasError = true;
setError("No active project statuses found.");
} else {
setStatuses(databaseStatuses);
}
}
    if (followUpsResult.error) {
      console.error(followUpsResult.error);
      setError("Follow-ups: " + followUpsResult.error.message);
      hasError = true;
    } else {
      setFollowUps((followUpsResult.data || []) as FollowUp[]);
    }

    if (!hasError && clearExistingError) {
      setError("");
    }

    setLoading(false);
  }

useEffect(() => {
  if (session) {
    loadData();
  }
}, [session]);
async function handleLogin(e: React.FormEvent) {

  e.preventDefault();

  setLoggingIn(true);
  setLoginError("");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setLoginError(error.message);
  }

  setLoggingIn(false);
}
async function handleLogout() {
  await supabase.auth.signOut();
}
  function getCompanyName(id: string | null) {
    if (!id) return "-";

    const company = companies.find((item) => item.id === id);

    return company ? company.name : "-";
  }

  function openCompanyProjects(company: Company) {
    setProjectCompanyFilter(company.id);
    setProjectSearch("");
    setProjectAssignedToFilter("all");
    setProjectView("all");
    setProjectSort("date_desc");
    setPage("projects");
  }

  function getCustomerGroupLabel(group: Company["customer_group"]) {
    if (group === "contracting_company") return "Contracting Co";
    if (group === "consultant_company") return "Consultant Co";
    return "General Customer";
  }

  function getStatusName(id: string | null) {
    if (!id) return "-";

    const status = statuses.find((item) => item.id === id);

    return status ? status.name : "-";
  }

  function openProjectsForStatus(statusGroup: string) {
    setProjectStatusFilter(statusGroup);
    setProjectCompanyFilter(null);
    setProjectSearch("");
    setProjectAssignedToFilter("all");
    setProjectView("all");
    setProjectSort("date_desc");
    setPage("projects");
  }

  function getProfileName(id: string | null) {
    if (!id) return "-";

    const profile = profiles.find((item) => item.id === id);

    return profile ? profile.full_name : "-";
  }

  function getTeamMemberName(id: string | null) {
    if (!id) return "-";

    const member = teamMembers.find((item) => item.id === id);

    return member ? member.full_name : "-";
  }

  function getFollowUpProject(followUp: FollowUp) {
    return projects.find(
      (project) => project.id === followUp.project_id
    );
  }

  function getAutomaticFollowUpDays(statusId: string) {
    const statusName = getStatusName(statusId);

    return (
      AUTOMATIC_FOLLOW_UP_DAYS[
        statusName.trim().toLowerCase()
      ] ?? null
    );
  }

  function getSuggestedFollowUpDate(
    projectDate: string,
    statusId: string
  ) {
    if (!projectDate || !statusId) return "";

    const days = getAutomaticFollowUpDays(statusId);

    if (days === null) return "";

    return addDaysToDate(projectDate, days);
  }

  function openNewProject() {
    setEditingProjectId(null);
    setCopyingProject(false);

    setProjectForm({
      ...emptyProject,
      projectDate: getTodayString(),
    });

    setError("");
    setShowProjectModal(true);
  }

  function openEditProject(project: Project) {
    setEditingProjectId(project.id);
    setCopyingProject(false);

    setProjectForm({
      sn: project.sn || "",
      projectName: project.project_name || "",
      customerId: project.customer_id || "",
      contractingCompanyId:
        project.contracting_company_id || "",
      contractorId: project.contractor_id || "",
      consultantId: project.consultant_id || "",
      contractorName: project.contractor_name || "",
      consultantName: project.consultant_name || "",
      mobileNo: project.mobile_no || "",
      projectDate: project.project_date || "",
      statusId: project.status_id || "",
      estimatedSaleJd:
        project.estimated_sale_jd === null
          ? ""
          : String(project.estimated_sale_jd),
      estimatedCostJd:
        project.estimated_cost_jd === null
          ? ""
          : String(project.estimated_cost_jd),
      assignedTo: project.assigned_to || "",
      preparedBy: project.prepared_by_other
        ? "__other__"
        : project.prepared_by || "",
      preparedByOther: project.prepared_by_other || "",
      notes: project.notes || "",
      rejectionReason: project.rejection_reason || "",
      specificationMismatch:
        project.specification_mismatch || "",
    });

    setError("");
    setShowDetailsModal(false);
    setShowProjectModal(true);
  }

  function openCopyProject(project: Project) {
    setEditingProjectId(null);
    setCopyingProject(true);

    setProjectForm({
      sn: project.sn || "",
      projectName: project.project_name || "",
      customerId: project.customer_id || "",
      contractingCompanyId: project.contracting_company_id || "",
      contractorId: project.contractor_id || "",
      consultantId: project.consultant_id || "",
      contractorName: project.contractor_name || "",
      consultantName: project.consultant_name || "",
      mobileNo: project.mobile_no || "",
      projectDate: project.project_date || "",
      statusId: project.status_id || "",
      estimatedSaleJd:
        project.estimated_sale_jd === null
          ? ""
          : String(project.estimated_sale_jd),
      estimatedCostJd:
        project.estimated_cost_jd === null
          ? ""
          : String(project.estimated_cost_jd),
      assignedTo: project.assigned_to || "",
      preparedBy: project.prepared_by_other
        ? "__other__"
        : project.prepared_by || "",
      preparedByOther: project.prepared_by_other || "",
      notes: project.notes || "",
      rejectionReason: project.rejection_reason || "",
      specificationMismatch: project.specification_mismatch || "",
    });

    setError("");
    setShowDetailsModal(false);
    setShowProjectModal(true);
  }

  function openProjectDetails(project: Project) {
    setSelectedProject(project);
    setError("");
    setShowDetailsModal(true);
  }

  function openNewFollowUp(project?: Project) {
    setSelectedProject(project || null);

    let suggestedDate = "";

    if (project) {
      suggestedDate = getSuggestedFollowUpDate(
        project.project_date || "",
        project.status_id || ""
      );
    }

    setFollowUpForm({
      ...emptyFollowUp,
      projectId: project?.id || "",
      assignedTo: project?.assigned_to || "",
      followUpDate: suggestedDate,
    });

    setError("");
    setShowDetailsModal(false);
    setShowFollowUpModal(true);
  }

  function openNewCustomer(
    fromProject = false,
    projectField: "customer" | "contracting" | "consultant" = "customer"
  ) {
    setEditingCustomerId(null);
    const customerGroup =
      projectField === "contracting"
        ? "contracting_company"
        : projectField === "consultant"
          ? "consultant_company"
          : "general_customer";
    setCustomerForm({ ...emptyCustomer, customerGroup });
    setCustomerModalFromProject(fromProject);
    setCustomerModalProjectField(projectField);
    setCustomerFormError("");
    setError("");
    setShowCustomerModal(true);
  }

  function openEditCustomer(company: Company) {
    setEditingCustomerId(company.id);

    setCustomerForm({
      name: company.name || "",
      phone: company.phone || "",
      email: company.email || "",
      notes: company.notes || "",
      customerGroup: company.customer_group || "general_customer",
      generalCustomerType: company.general_customer_type || "company",
      contacts: companyContacts
        .filter((contact) => contact.company_id === company.id)
        .map((contact) => ({
          id: contact.id,
          fullName: contact.full_name,
          phone: contact.phone || "",
          email: contact.email || "",
        })),
    });

    setCustomerModalFromProject(false);
    setCustomerFormError("");
    setError("");
    setShowCustomerModal(true);
  }

  async function createAutomaticFirstFollowUp(
    projectId: string,
    projectDate: string | null,
    statusId: string | null
  ) {
    if (!projectDate || !statusId) return;

    const days = getAutomaticFollowUpDays(statusId);

    if (days === null) return;

    const followUpDate = addDaysToDate(projectDate, days);

    if (!followUpDate) return;

    const result = await supabase
      .from("follow_ups")
      .insert({
        project_id: projectId,
        follow_up_date: followUpDate,
        notes: "Automatic first follow-up",
        completed: false,
      });

if (result.error) {
const dbError = result.error;
console.error("Automatic follow-up insert failed:", {
code: dbError.code,
message: dbError.message,
details: dbError.details,
hint: dbError.hint,
});
setError(
"Project saved, but the automatic follow-up could not be created: " +
(
dbError.message ||
dbError.details ||
dbError.hint ||
"Unknown database error"
)
);
}
  }

  async function createMissingAutomaticFollowUp(
    project: Project
  ) {
    if (!project.project_date || !project.status_id) {
      return;
    }

    const days = getAutomaticFollowUpDays(project.status_id);

    if (days === null) {
      return;
    }

    const existing = followUps.some(
      (followUp) =>
        followUp.project_id === project.id
    );

    if (existing) {
      return;
    }

    await createAutomaticFirstFollowUp(
      project.id,
      project.project_date,
      project.status_id
    );
  }

  async function saveProject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!projectForm.projectName.trim()) {
      setError("Project Name is required.");
      return;
    }

    if (
      projectForm.estimatedSaleJd &&
      Number.isNaN(Number(projectForm.estimatedSaleJd))
    ) {
      setError("Estimated Sale must be a valid number.");
      return;
    }

    if (
      projectForm.estimatedCostJd &&
      Number.isNaN(Number(projectForm.estimatedCostJd))
    ) {
      setError("Estimated Cost must be a valid number.");
      return;
    }

    if (
      projectForm.preparedBy === "__other__" &&
      !projectForm.preparedByOther.trim()
    ) {
      setError("Please enter the name of the person who prepared the project.");
      return;
    }

if (
projectForm.statusId &&
!statuses.some((status) => status.id === projectForm.statusId)
) {
setError("Please select a valid project status.");
return;
}

if (
  normalizeStatusGroup(getStatusName(projectForm.statusId)) === "lost" &&
  (!projectForm.rejectionReason.trim() ||
    projectForm.rejectionReason === "__other__")
) {
  setError("Please select or enter a lost reason.");
  return;
}

    setSaving(true);
    setError("");

    const projectData = {
      sn: projectForm.sn.trim() || null,
      project_name: projectForm.projectName.trim(),
      customer_id: projectForm.customerId || null,
      contracting_company_id:
        projectForm.contractingCompanyId || null,
      contractor_id: projectForm.contractorId || null,
      consultant_id: projectForm.consultantId || null,
      contractor_name:
        projectForm.contractorName.trim() || null,
      consultant_name:
        projectForm.consultantName.trim() || null,
      mobile_no: projectForm.mobileNo.trim() || null,
      project_date: projectForm.projectDate || null,
      status_id: projectForm.statusId || null,
      estimated_sale_jd: projectForm.estimatedSaleJd
        ? Number(projectForm.estimatedSaleJd)
        : null,
      estimated_cost_jd: projectForm.estimatedCostJd
        ? Number(projectForm.estimatedCostJd)
        : null,
      assigned_to: projectForm.assignedTo || null,
      prepared_by:
        projectForm.preparedBy === "__other__"
          ? null
          : projectForm.preparedBy || null,
      prepared_by_other:
        projectForm.preparedBy === "__other__"
          ? projectForm.preparedByOther.trim() || null
          : null,
      notes: projectForm.notes.trim() || null,
      rejection_reason:
        projectForm.rejectionReason.trim() || null,
      specification_mismatch:
        projectForm.specificationMismatch.trim() || null,
    };

    let result;

    if (editingProjectId) {
      result = await supabase
        .from("projects")
        .update(projectData)
        .eq("id", editingProjectId);

if (result.error) {
const dbError = result.error;
console.error("Project update failed:", {
code: dbError.code,
message: dbError.message,
details: dbError.details,
hint: dbError.hint,
});
setError(
dbError.message ||
dbError.details ||
dbError.hint ||
"Could not update the project."
);
setSaving(false);
return;
}

      const updatedProject = {
        ...projectData,
        id: editingProjectId,
      } as Project;

      await createMissingAutomaticFollowUp(
        updatedProject
      );
    } else {
      result = await supabase
        .from("projects")
        .insert(projectData)
        .select(
          "id,sn,project_name,customer_id,contracting_company_id,contractor_id,consultant_id,contractor_name,consultant_name,mobile_no,project_date,status_id,estimated_sale_jd,estimated_cost_jd,assigned_to,prepared_by,prepared_by_other,notes,rejection_reason,specification_mismatch,hidden,created_at,updated_at"
        )
        .single();

if (result.error) {
  const dbError = result.error;

  console.error("PROJECT INSERT ERROR:", dbError);
  console.error("CODE:", dbError?.code);
  console.error("MESSAGE:", dbError?.message);
  console.error("DETAILS:", dbError?.details);
  console.error("HINT:", dbError?.hint);

  setError(
    "Project insert failed: " +
      (dbError?.message || "Unknown database error")
  );

  return;
}
      if (result.data) {
        await createAutomaticFirstFollowUp(
          result.data.id,
          result.data.project_date,
          result.data.status_id
        );
      }
    }

    setSaving(false);
    setShowProjectModal(false);
    setEditingProjectId(null);
    setCopyingProject(false);
    setProjectForm({ ...emptyProject });

await loadData(false);
  }

  async function saveCustomer(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!customerForm.name.trim()) {
      setCustomerFormError("Customer name is required.");
      return;
    }

    const normalizedName = customerForm.name.trim().toLocaleLowerCase();
    const normalizedPhone = customerForm.phone.replace(/\D/g, "");
    const duplicate = companies.find((company) => {
      if (company.id === editingCustomerId) return false;

      const sameName = company.name.trim().toLocaleLowerCase() === normalizedName;
      const companyPhone = (company.phone || "").replace(/\D/g, "");
      const samePhone = Boolean(normalizedPhone) && companyPhone === normalizedPhone;

      return sameName || samePhone;
    });

    if (duplicate) {
      const duplicateReason =
        duplicate.name.trim().toLocaleLowerCase() === normalizedName
          ? "name"
          : "mobile number";
      setCustomerFormError(
        `A customer with the same ${duplicateReason} already exists: ${duplicate.name}.`
      );
      return;
    }

    setSavingCustomer(true);
    setError("");
    setCustomerFormError("");

    const companyData = {
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim() || null,
      email: customerForm.email.trim() || null,
      notes: customerForm.notes.trim() || null,
      customer_group: customerForm.customerGroup,
      general_customer_type:
        customerForm.customerGroup === "general_customer"
          ? customerForm.generalCustomerType
          : null,
    };

    let result;

    if (editingCustomerId) {
      result = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", editingCustomerId)
        .select("id,name,phone,email,notes,customer_group,general_customer_type,active")
        .single();
    } else {
      result = await supabase
        .from("companies")
        .insert(companyData)
        .select("id,name,phone,email,notes,customer_group,general_customer_type,active")
        .single();
    }

    if (result.error) {
      console.error(result.error);
      setCustomerFormError(result.error.message);
      setSavingCustomer(false);
      return;
    }

    const savedCustomer = result.data as Company;

    const contactsToSave = customerForm.contacts
      .map((contact) => ({
        company_id: savedCustomer.id,
        full_name: contact.fullName.trim(),
        phone: contact.phone.trim() || null,
        email: contact.email.trim() || null,
        active: true,
      }))
      .filter((contact) => contact.full_name);

    const deleteContactsResult = await supabase
      .from("company_contacts")
      .delete()
      .eq("company_id", savedCustomer.id);

    if (deleteContactsResult.error) {
      setEditingCustomerId(savedCustomer.id);
      setCustomerFormError("Customer saved, but contacts could not be updated: " + deleteContactsResult.error.message);
      setSavingCustomer(false);
      return;
    }

    let savedContacts: CompanyContact[] = [];
    if (contactsToSave.length > 0) {
      const contactsResult = await supabase
        .from("company_contacts")
        .insert(contactsToSave)
        .select("id,company_id,full_name,phone,email,active");

      if (contactsResult.error) {
        setEditingCustomerId(savedCustomer.id);
        setCustomerFormError("Customer saved, but contacts could not be added: " + contactsResult.error.message);
        setSavingCustomer(false);
        return;
      }

      savedContacts = (contactsResult.data || []) as CompanyContact[];
    }

    setCompanies((current) =>
      [...current.filter((company) => company.id !== savedCustomer.id), savedCustomer]
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setCompanyContacts((current) => [
      ...current.filter((contact) => contact.company_id !== savedCustomer.id),
      ...savedContacts,
    ]);

    if (customerModalFromProject && !editingCustomerId) {
      setProjectForm((current) => ({
        ...current,
        customerId:
          customerModalProjectField === "customer"
            ? savedCustomer.id
            : current.customerId,
        contractingCompanyId:
          customerModalProjectField === "contracting"
            ? savedCustomer.id
            : current.contractingCompanyId,
        consultantId:
          customerModalProjectField === "consultant"
            ? savedCustomer.id
            : current.consultantId,
      }));
    }

    setSavingCustomer(false);
    setShowCustomerModal(false);
    setEditingCustomerId(null);
    setCustomerForm({ ...emptyCustomer });

  }

  async function deleteCustomer(company: Company) {
    setError("");

    const relatedProjects = projects.filter(
      (project) =>
        project.customer_id === company.id ||
        project.contracting_company_id === company.id ||
        project.contractor_id === company.id ||
        project.consultant_id === company.id
    );

    if (relatedProjects.length > 0) {
      window.alert(
        `Cannot delete "${company.name}" because it is connected to ${relatedProjects.length} project${relatedProjects.length === 1 ? "" : "s"}. Reassign those projects first so no project information is lost.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${company.name}"?\n\nThis permanently deletes the company and its related people. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingCustomerId(company.id);

    const result = await supabase
      .from("companies")
      .delete()
      .eq("id", company.id)
      .select("id");

    if (result.error) {
      setError(
        "Could not delete company. It may still have related people or database records: " +
          result.error.message
      );
      setDeletingCustomerId(null);
      return;
    }

    if (result.data.length !== 1) {
      setError(
        "The company was not deleted. Please check the Supabase delete policy for companies."
      );
      setDeletingCustomerId(null);
      return;
    }

    setCompanies((current) =>
      current.filter((item) => item.id !== company.id)
    );
    setCompanyContacts((current) =>
      current.filter((contact) => contact.company_id !== company.id)
    );
    setDeletingCustomerId(null);
  }

  async function saveFollowUp(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!followUpForm.projectId) {
      setError("Please select a project.");
      return;
    }

    if (!followUpForm.followUpDate) {
      setError("Follow-up date is required.");
      return;
    }

    setSavingFollowUp(true);
    setError("");

    const result = await supabase
      .from("follow_ups")
      .insert({
        project_id: followUpForm.projectId,
        assigned_to: followUpForm.assignedTo || null,
        follow_up_date: followUpForm.followUpDate,
        notes: followUpForm.notes.trim() || null,
        completed: false,
      });

if (result.error) {
  const dbError = result.error;

  console.error(
    "FOLLOW-UP INSERT ERROR:",
    JSON.stringify(
      {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
      },
      null,
      2
    )
  );

  setError(
    dbError.message ||
      dbError.details ||
      dbError.hint ||
      "Failed to save follow-up."
  );

  setSavingFollowUp(false);
  return;
}
    setSavingFollowUp(false);
    setShowFollowUpModal(false);
    setFollowUpForm({ ...emptyFollowUp });

    await loadData();
  }

  async function toggleFollowUp(
    followUp: FollowUp
  ) {
    setError("");

    const newCompleted = !followUp.completed;

    const result = await supabase
      .from("follow_ups")
      .update({
        completed: newCompleted,
        completed_at: newCompleted
          ? new Date().toISOString()
          : null,
      })
      .eq("id", followUp.id);

    if (result.error) {
      console.error(result.error);
      setError(result.error.message);
      return;
    }

    await loadData();
  }

  async function toggleProjectHidden(
    project: Project
  ) {
    setError("");

    const result = await supabase
      .from("projects")
      .update({
        hidden: !project.hidden,
      })
      .eq("id", project.id);

    if (result.error) {
      console.error(result.error);
      setError(
        "Could not update project visibility: " +
          result.error.message
      );
      return;
    }

    if (selectedProject?.id === project.id) {
      setSelectedProject({
        ...selectedProject,
        hidden: !project.hidden,
      });
    }

    await loadData();
  }

  async function deleteProject(project: Project) {
    const projectName =
      project.project_name?.trim() || "this project";

    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis permanently deletes the project and all related follow-ups. This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    setError("");

    const followUpDeleteResult = await supabase
      .from("follow_ups")
      .delete()
      .eq("project_id", project.id)
      .select("id");

    if (followUpDeleteResult.error) {
      console.error("Follow-up deletion failed:", followUpDeleteResult.error);
      setError(
        "Could not delete the project's follow-ups: " +
          followUpDeleteResult.error.message
      );
      setDeletingProject(false);
      return;
    }

    const projectDeleteResult = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id)
      .select("id");

    if (projectDeleteResult.error) {
      console.error("Project deletion failed:", projectDeleteResult.error);
      setError(
        "Could not delete project: " +
          projectDeleteResult.error.message
      );
      setDeletingProject(false);
      await loadData(false);
      return;
    }

    if (projectDeleteResult.data.length !== 1) {
      setError(
        "The project was not deleted. Please check the Supabase delete policy for projects."
      );
      setDeletingProject(false);
      await loadData(false);
      return;
    }

    setProjects((currentProjects) =>
      currentProjects.filter((item) => item.id !== project.id)
    );
    setFollowUps((currentFollowUps) =>
      currentFollowUps.filter(
        (followUp) => followUp.project_id !== project.id
      )
    );
    setSelectedProject(null);
    setShowDetailsModal(false);
    setShowProjectModal(false);
    setDeletingProject(false);

    await loadData(false);
  }

  const currentTeamMember = useMemo(
    () =>
      teamMembers.find(
        (member) =>
          member.auth_user_id === session?.user?.id
      ) || null,
    [teamMembers, session?.user?.id]
  );

  const isAdmin =
    currentTeamMember?.role.trim().toLowerCase() === "admin";

  const accessibleProjects = useMemo(() => {
    if (isAdmin) {
      return projects;
    }

    if (!currentTeamMember) {
      return [];
    }

    return projects.filter(
      (project) =>
        project.assigned_to === currentTeamMember.id
    );
  }, [projects, currentTeamMember, isAdmin]);

  const accessibleProjectIds = useMemo(
    () =>
      new Set(
        accessibleProjects.map((project) => project.id)
      ),
    [accessibleProjects]
  );

  const accessibleFollowUps = useMemo(
    () =>
      followUps.filter((followUp) =>
        accessibleProjectIds.has(followUp.project_id)
      ),
    [followUps, accessibleProjectIds]
  );

  const filteredProjects = useMemo(() => {
    const search = projectSearch.trim().toLowerCase();

    let result = accessibleProjects.filter((project) => {
      if (projectView === "active") {
        return !project.hidden;
      }

      if (projectView === "hidden") {
        return project.hidden;
      }

      return true;
    });

    if (projectAssignedToFilter !== "all") {
      result = result.filter(
        (project) =>
          project.assigned_to === projectAssignedToFilter
      );
    }

    if (projectCompanyFilter) {
      result = result.filter(
        (project) =>
          project.customer_id === projectCompanyFilter ||
          project.contracting_company_id === projectCompanyFilter ||
          project.contractor_id === projectCompanyFilter ||
          project.consultant_id === projectCompanyFilter
      );
    }

    if (projectStatusFilter !== "all") {
      result = result.filter(
        (project) =>
          normalizeStatusGroup(getStatusName(project.status_id)) ===
          projectStatusFilter
      );
    }

    if (search) {
      result = result.filter((project) => {
        const values = [
          project.sn,
          project.project_name,
          getCompanyName(project.customer_id),
          getCompanyName(
            project.contracting_company_id
          ),
          getCompanyName(project.contractor_id),
          getCompanyName(project.consultant_id),
          project.contractor_name,
          project.consultant_name,
          project.mobile_no,
          getStatusName(project.status_id),
          getTeamMemberName(project.assigned_to),
        ];

        return values.some(
          (value) =>
            value &&
            String(value)
              .toLowerCase()
              .includes(search)
        );
      });
    }

    result.sort((a, b) => {
      switch (projectSort) {
        case "created_asc":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "created_desc":
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );

        case "date_asc":
          if (!a.project_date) return 1;
          if (!b.project_date) return -1;
          return a.project_date.localeCompare(b.project_date);

        case "date_desc":
          if (!a.project_date) return 1;
          if (!b.project_date) return -1;
          return b.project_date.localeCompare(a.project_date);

        case "name_asc":
          return (
            (a.project_name || "").localeCompare(
              b.project_name || ""
            )
          );

        case "name_desc":
          return (
            (b.project_name || "").localeCompare(
              a.project_name || ""
            )
          );

        case "sale_desc":
          return (
            (b.estimated_cost_jd || 0) -
            (a.estimated_cost_jd || 0)
          );

        case "sale_asc":
          return (
            (a.estimated_cost_jd || 0) -
            (b.estimated_cost_jd || 0)
          );

        case "status":
          return getStatusName(
            a.status_id
          ).localeCompare(
            getStatusName(b.status_id)
          );

        default:
          return 0;
      }
    });

    return result;
  }, [
    accessibleProjects,
    projectSearch,
    projectAssignedToFilter,
    projectCompanyFilter,
    projectStatusFilter,
    projectView,
    projectSort,
    companies,
    statuses,
    profiles,
  ]);

  const projectStatusSummary = useMemo(() => {
    const summary = new Map<string, number>();
    accessibleProjects.forEach((project) => {
      const statusName = getStatusName(project.status_id);
      if (!statusName || statusName === "-") return;
      const group = normalizeStatusGroup(statusName);
      summary.set(group, (summary.get(group) || 0) + 1);
    });

    return Array.from(summary.entries())
      .map(([group, count]) => ({
        group,
        label: getStatusGroupLabel(group),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [accessibleProjects, statuses]);

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    const groupedCompanies = companies.filter(
      (company) => company.customer_group === customerGroupFilter
    );

    if (!search) return groupedCompanies;

    return groupedCompanies.filter((company) => {
      const values = [
        company.name,
        company.phone,
        company.email,
        company.notes,
        getCustomerGroupLabel(company.customer_group),
        company.general_customer_type,
        ...companyContacts
          .filter((contact) => contact.company_id === company.id)
          .flatMap((contact) => [contact.full_name, contact.phone, contact.email]),
        company.active ? "active" : "inactive",
      ];

      return values.some(
        (value) =>
          value &&
          String(value)
            .toLowerCase()
            .includes(search)
      );
    });
  }, [companies, companyContacts, customerGroupFilter, customerSearch]);

  const today = getTodayString();

  const assigneeFollowUps =
    assignedToFilter === "all"
      ? accessibleFollowUps
      : accessibleFollowUps.filter((followUp) => {
          const project = getFollowUpProject(followUp);

          return (
            followUp.assigned_to ||
            project?.assigned_to
          ) === assignedToFilter;
        });

  const openFollowUps = assigneeFollowUps.filter(
    (item) => !item.completed
  );

  const completedFollowUps = assigneeFollowUps.filter(
    (item) => item.completed
  );

  const overdueFollowUps = openFollowUps.filter(
    (item) =>
      item.follow_up_date &&
      item.follow_up_date < today
  );

  const todayFollowUps = openFollowUps.filter(
    (item) => item.follow_up_date === today
  );

const filteredFollowUps =
  followUpFilter === "open"
    ? openFollowUps
    : followUpFilter === "today"
      ? todayFollowUps
      : followUpFilter === "overdue"
        ? overdueFollowUps
        : followUpFilter === "completed"
          ? completedFollowUps
          : assigneeFollowUps;

  const activeProjectsCount = accessibleProjects.filter(
    (project) => !project.hidden
  ).length;

  const hiddenProjectsCount = accessibleProjects.filter(
    (project) => project.hidden
  ).length;

  const nextFollowUpForSelectedProject =
    selectedProject
      ? followUps
          .filter(
            (followUp) =>
              followUp.project_id ===
                selectedProject.id &&
              !followUp.completed &&
              !!followUp.follow_up_date
          )
          .sort(
            (a, b) =>
              new Date(
                `${a.follow_up_date}T00:00:00`
              ).getTime() -
              new Date(
                `${b.follow_up_date}T00:00:00`
              ).getTime()
          )[0]
      : null;
if (checkingAuth) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-gray-600">Loading...</p>
    </div>
  );
}

if (!session) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg"
      >
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          Sales CRM
        </h1>

        <p className="mb-6 text-gray-500">
          Sign in to your account
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3"
        />

        {loginError && (
          <p className="mb-4 text-sm text-red-600">
            {loginError}
          </p>
        )}

        <button
          type="submit"
          disabled={loggingIn}
          className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loggingIn ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
<aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900 text-white">

  <div className="border-b border-gray-700 p-6">
    <h1 className="text-2xl font-bold">
      Sales CRM
    </h1>

    <p className="mt-1 text-sm text-gray-400">
      Sales Management
    </p>
  </div>

  <nav className="p-4">
    <NavButton
      active={page === "dashboard"}
      onClick={() => setPage("dashboard")}
    >
      Dashboard
    </NavButton>

    <NavButton
      active={page === "projects"}
      onClick={() => setPage("projects")}
    >
      Projects
    </NavButton>

    <NavButton
      active={page === "customers"}
      onClick={() => setPage("customers")}
    >
      Customers
    </NavButton>

    <NavButton
      active={page === "team"}
      onClick={() => setPage("team")}
    >
      Team Members
    </NavButton>

    <NavButton
      active={page === "followups"}
      onClick={() => {
  setFollowUpFilter("all");
  setPage("followups");
}}
    >
      Follow-ups
    </NavButton>
  </nav>

  {/* LOGOUT BUTTON */}
  <div className="absolute bottom-6 left-4 right-4">
    <button
      onClick={handleLogout}
      className="w-full rounded-lg px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
    >
      Logout
    </button>
  </div>

</aside>
      <main className="ml-64 min-h-screen p-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-xl font-bold"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {page === "dashboard" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">
                  Dashboard
                </h2>

                <p className="mt-1 text-gray-500">
                  Overview of your sales CRM
                </p>
              </div>

              <button
                type="button"
                onClick={openNewProject}
                className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
              >
                + Add Project
              </button>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
              <DashboardCard
                title="Active Projects"
                value={
                  loading
                    ? "..."
                    : String(activeProjectsCount)
                }
              />

              <DashboardCard
                title="Customers"
                value={
                  loading
                    ? "..."
                    : String(companies.length)
                }
              />

<DashboardCard
  title="Open Follow-ups"
  value={
    loading
      ? "..."
      : String(openFollowUps.length)
  }
  onClick={() => {
    setFollowUpFilter("open");
    setPage("followups");
  }}
/>
              <DashboardCard
                title="Follow-ups Today"
                value={
                  loading
                    ? "..."
                    : String(todayFollowUps.length)
                }
                onClick={() => {
                  setFollowUpFilter("today");
                  setPage("followups");
                }}
              />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
<FollowUpSummaryCard
  title="Overdue Follow-ups"
  value={overdueFollowUps.length}
  onClick={() => {
    setFollowUpFilter("overdue");
    setPage("followups");
  }}
/>

<FollowUpSummaryCard
  title="Today's Follow-ups"
  value={todayFollowUps.length}
  onClick={() => {
    setFollowUpFilter("today");
    setPage("followups");
  }}
/>
              <FollowUpSummaryCard
                title="Hidden Projects"
                value={hiddenProjectsCount}
                onClick={() => {
                  setProjectView("hidden");
                  setPage("projects");
                }}
              />
            </div>

            <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Projects by Status</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a status to see all matching projects.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                {projectStatusSummary.map((item) => (
                  <button
                    key={item.group}
                    type="button"
                    onClick={() => openProjectsForStatus(item.group)}
                    className="rounded-lg border border-gray-200 p-4 text-left transition hover:border-green-500 hover:bg-green-50"
                  >
                    <StatusBadge statusName={item.label} />
                    <p className="mt-3 text-2xl font-bold text-gray-900">
                      {item.count}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-6">
                <h3 className="text-xl font-semibold">
                  Recent Projects
                </h3>

                <button
                  type="button"
                  onClick={() => loadData()}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              <ProjectTable
                projects={accessibleProjects
                  .filter(
                    (project) => !project.hidden
                  )
                  .sort((a, b) => {
                    if (!a.project_date) return 1;
                    if (!b.project_date) return -1;

                    const dateComparison =
                      b.project_date.localeCompare(a.project_date);

                    if (dateComparison !== 0) {
                      return dateComparison;
                    }

                    return b.created_at.localeCompare(a.created_at);
                  })
                  .slice(0, 10)}
                loading={loading}
                getCompanyName={getCompanyName}
                getStatusName={getStatusName}
                getProfileName={getTeamMemberName}
                onCopy={openCopyProject}
                onEdit={openEditProject}
                onDetails={openProjectDetails}
              />
            </div>
          </>
        )}

        {page === "projects" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">
                  Projects
                </h2>

                <p className="mt-1 text-gray-500">
                  Add, view, edit, hide and manage projects
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => openNewFollowUp()}
                  className="rounded-lg bg-orange-500 px-5 py-3 font-medium text-white hover:bg-orange-600"
                >
                  + Add Follow-Up
                </button>

                <button
                  type="button"
                  onClick={openNewProject}
                  className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
                >
                  + Add Project
                </button>
              </div>
            </div>

            <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
              {projectCompanyFilter && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-900">
                    Showing all projects connected to{" "}
                    {getCompanyName(projectCompanyFilter)}
                  </p>

                  <button
                    type="button"
                    onClick={() => setProjectCompanyFilter(null)}
                    className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Clear Company Filter
                  </button>
                </div>
              )}

              {projectStatusFilter !== "all" && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-900">
                    Showing status: {getStatusGroupLabel(projectStatusFilter)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProjectStatusFilter("all")}
                    className="rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                  >
                    Clear Status Filter
                  </button>
                </div>
              )}

              <div className="mb-4">
                <input
                  value={projectSearch}
                  onChange={(event) =>
                    setProjectSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search projects, customers, contractor..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
                />
              </div>

              {isAdmin && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-600">
                    Filter Projects by Salesperson
                  </label>
                  <select
                    value={projectAssignedToFilter}
                    onChange={(event) =>
                      setProjectAssignedToFilter(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-green-500 md:max-w-md"
                  >
                    <option value="all">All Team Members</option>
                    {teamMembers
                      .filter((member) => member.active)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <ViewButton
                    active={projectView === "active"}
                    onClick={() =>
                      setProjectView("active")
                    }
                  >
                    Active ({activeProjectsCount})
                  </ViewButton>

                  <ViewButton
                    active={projectView === "hidden"}
                    onClick={() =>
                      setProjectView("hidden")
                    }
                  >
                    Hidden ({hiddenProjectsCount})
                  </ViewButton>

                  <ViewButton
                    active={projectView === "all"}
                    onClick={() =>
                      setProjectView("all")
                    }
                  >
                    All ({accessibleProjects.length})
                  </ViewButton>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-600">
                    Sort:
                  </label>

                  <select
                    value={projectSort}
                    onChange={(event) =>
                      setProjectSort(
                        event.target
                          .value as ProjectSort
                      )
                    }
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-green-500"
                  >
                    <option value="created_desc">
                      Added to CRM — Newest First
                    </option>

                    <option value="created_asc">
                      Added to CRM — Oldest First
                    </option>

                    <option value="date_desc">
                      Project Date — Newest First
                    </option>

                    <option value="date_asc">
                      Project Date — Oldest First
                    </option>

                    <option value="name_asc">
                      Project Name — A to Z
                    </option>

                    <option value="name_desc">
                      Project Name — Z to A
                    </option>

                    <option value="sale_desc">
                      Estimated Cost — Highest
                    </option>

                    <option value="sale_asc">
                      Estimated Cost — Lowest
                    </option>

                    <option value="status">
                      Status
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {filteredProjects.length} project
                {filteredProjects.length === 1
                  ? ""
                  : "s"}
              </p>

              {projectView === "hidden" && (
                <p className="text-sm font-medium text-orange-600">
                  Hidden projects are still stored safely.
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <ProjectTable
                projects={filteredProjects}
                loading={loading}
                getCompanyName={getCompanyName}
                getStatusName={getStatusName}
                getProfileName={getTeamMemberName}
                onCopy={openCopyProject}
                onEdit={openEditProject}
                onDetails={openProjectDetails}
              />
            </div>
          </>
        )}

        {page === "customers" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">
                  Customers
                </h2>

                <p className="mt-1 text-gray-500">
                  Manage your companies
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  openNewCustomer(
                    false,
                    customerGroupFilter === "contracting_company"
                      ? "contracting"
                      : customerGroupFilter === "consultant_company"
                        ? "consultant"
                        : "customer"
                  )
                }
                className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
              >
                + Add {customerGroupFilter === "consultant_company"
                  ? "Consultant"
                  : customerGroupFilter === "contracting_company"
                    ? "Contractor"
                    : "Client"}
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ["consultant_company", "Consultants"],
                ["contracting_company", "Contractors"],
                ["general_customer", "Clients"],
              ] as const).map(([value, label]) => {
                const count = companies.filter(
                  (company) => company.customer_group === value
                ).length;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCustomerGroupFilter(value)}
                    className={
                      customerGroupFilter === value
                        ? "rounded-xl bg-green-600 px-5 py-4 text-left font-semibold text-white shadow-sm"
                        : "rounded-xl border border-gray-200 bg-white px-5 py-4 text-left font-semibold text-gray-700 shadow-sm hover:border-green-300 hover:bg-green-50"
                    }
                  >
                    <span className="block">{label}</span>
                    <span
                      className={
                        customerGroupFilter === value
                          ? "mt-1 block text-sm font-normal text-green-100"
                          : "mt-1 block text-sm font-normal text-gray-500"
                      }
                    >
                      {count} {count === 1 ? "record" : "records"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
              <input
                value={customerSearch}
                onChange={(event) =>
                  setCustomerSearch(
                    event.target.value
                  )
                }
                placeholder={`Search ${
                  customerGroupFilter === "consultant_company"
                    ? "consultants"
                    : customerGroupFilter === "contracting_company"
                      ? "contractors"
                      : "clients"
                }...`}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
              />
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              {loading ? (
                <div className="p-10 text-center text-gray-500">
                  Loading customers...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  No customers found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Company
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Phone
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Email
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Group
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Status
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Related People
                        </th>

                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Notes
                        </th>

                        <th className="px-6 py-4 text-right text-sm font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCustomers.map(
                        (company) => (
                          <tr
                            key={company.id}
                            className="border-t border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 font-medium">
                              <button
                                type="button"
                                onClick={() => openCompanyProjects(company)}
                                className="text-left font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                                title="View all projects connected to this company"
                              >
                                {company.name}
                              </button>
                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {company.phone || "-"}
                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {company.email || "-"}
                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {getCustomerGroupLabel(company.customer_group)}
                              {company.customer_group === "general_customer" && (
                                <span className="ml-1 text-xs text-gray-400">
                                  ({company.general_customer_type === "person" ? "Person" : "Company"})
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${company.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                                {company.active ? "Active" : "Inactive"}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {companyContacts
                                .filter((contact) => contact.company_id === company.id)
                                .map((contact) => contact.full_name)
                                .join(", ") || "-"}
                            </td>

                            <td className="px-6 py-4 text-gray-600">
                              {company.notes || "-"}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditCustomer(
                                    company
                                  )
                                }
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteCustomer(company)}
                                disabled={deletingCustomerId === company.id}
                                className="ml-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingCustomerId === company.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {page === "team" && (
          <TeamMembersSection
            teamMembers={teamMembers}
            projects={accessibleProjects}
            followUps={accessibleFollowUps}
            statuses={statuses}
            isAdmin={isAdmin}
            onChanged={loadData}
          />
        )}

        {page === "followups" && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">
                  Follow-ups
                </h2>

                <p className="mt-1 text-gray-500">
                  Track project follow-ups
                </p>
              </div>

              <button
                type="button"
                onClick={() => openNewFollowUp()}
                className="rounded-lg bg-orange-500 px-5 py-3 font-medium text-white hover:bg-orange-600"
              >
                + Add Follow-Up
              </button>
            </div>

            {isAdmin ? (
              <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Filter Follow-ups by Assigned To
                </label>

                <select
                  value={assignedToFilter}
                  onChange={(event) =>
                    setAssignedToFilter(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-500 md:max-w-md"
                >
                  <option value="all">All Team Members</option>

                  {teamMembers
                    .filter((member) => member.active)
                    .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Showing projects and follow-ups assigned to{" "}
                <span className="font-semibold">
                  {currentTeamMember?.full_name || "your account"}
                </span>
              </div>
            )}

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
              <FollowUpSummaryCard
                title="All"
                value={assigneeFollowUps.length}
                onClick={() => setFollowUpFilter("all")}
              />

              <FollowUpSummaryCard
                title="Open"
                value={openFollowUps.length}
                onClick={() => setFollowUpFilter("open")}
              />

              <FollowUpSummaryCard
                title="Today"
                value={todayFollowUps.length}
                onClick={() => setFollowUpFilter("today")}
              />

              <FollowUpSummaryCard
                title="Overdue"
                value={overdueFollowUps.length}
                onClick={() => setFollowUpFilter("overdue")}
              />

              <FollowUpSummaryCard
                title="Completed"
                value={completedFollowUps.length}
                onClick={() => setFollowUpFilter("completed")}
              />
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              {filteredFollowUps.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  No follow-ups found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left">
                          SN
                        </th>

                        <th className="px-6 py-4 text-left">
                          Project
                        </th>

                        <th className="px-6 py-4 text-left">
                          Assigned To
                        </th>

                        <th className="px-6 py-4 text-left">
                          Date
                        </th>

                        <th className="px-6 py-4 text-left">
                          Notes
                        </th>

                        <th className="px-6 py-4 text-left">
                          Status
                        </th>

                        <th className="px-6 py-4 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredFollowUps.map(
                        (followUp) => {
                          const project =
                            getFollowUpProject(
                              followUp
                            );

                          return (
                            <tr
                              key={followUp.id}
                              className="border-t border-gray-100"
                            >
                              <td className="px-6 py-4 font-medium">
                                {project?.sn || "-"}
                              </td>

                              <td className="px-6 py-4 font-medium">
                                {project?.project_name ||
                                  "-"}
                              </td>

                              <td className="px-6 py-4 text-gray-600">
                                {getTeamMemberName(
                                  followUp.assigned_to ||
                                    project?.assigned_to ||
                                    null
                                )}
                              </td>

                              <td className="px-6 py-4">
                                {formatDate(
                                  followUp.follow_up_date
                                )}
                              </td>

                              <td className="px-6 py-4 text-gray-600">
                                {followUp.notes ||
                                  "-"}
                              </td>

                              <td className="px-6 py-4">
                                <FollowUpStatus
                                  completed={
                                    followUp.completed
                                  }
                                />
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {project && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openProjectDetails(
                                          project
                                        )
                                      }
                                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
                                    >
                                      Project
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleFollowUp(
                                        followUp
                                      )
                                    }
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
                                  >
                                    {followUp.completed
                                      ? "Reopen"
                                      : "Complete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showProjectModal && (
        <Modal
          title={
            editingProjectId
              ? "Edit Project"
              : copyingProject
                ? "Copy Project"
                : "Add New Project"
          }
          onClose={() => {
            if (!saving) {
              setShowProjectModal(false);
            }
          }}
        >
          <form
            onSubmit={saveProject}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextInput
                label="SN"
                value={projectForm.sn}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    sn: value,
                  })
                }
                placeholder="Project number"
              />

              <TextInput
                label="Project Name"
                value={projectForm.projectName}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    projectName: value,
                  })
                }
                placeholder="Project name"
                required
              />

              <SelectInput
                label="General Customer"
                value={projectForm.customerId}
                onChange={(value) => {
                  if (value === "__new_customer__") {
                    openNewCustomer(true, "customer");
                    return;
                  }

                  setProjectForm({
                    ...projectForm,
                    customerId: value,
                  });
                }}
                options={[
                  {
                    value: "__new_customer__",
                    label: "+ New Customer",
                  },
                  ...companies.filter(
                    (company) =>
                      company.customer_group === "general_customer" &&
                      (company.active || company.id === projectForm.customerId)
                  ).map(
                  (company) => ({
                    value: company.id,
                    label: `${company.name} (${company.general_customer_type === "person" ? "Person" : "Company"})`,
                  })
                )]}
                placeholder="Select customer"
              />

              <SelectInput
                label="Contracting Co"
                value={
                  projectForm.contractingCompanyId
                }
                onChange={(value) => {
                  if (value === "__new_contracting_company__") {
                    openNewCustomer(true, "contracting");
                    return;
                  }
                  setProjectForm({
                    ...projectForm,
                    contractingCompanyId: value,
                    contractorName: "",
                    contractorId: "",
                  });
                }}
                options={[
                  { value: "__new_contracting_company__", label: "+ New Contracting Co" },
                  ...companies.filter(
                    (company) =>
                      company.customer_group === "contracting_company" &&
                      (company.active || company.id === projectForm.contractingCompanyId)
                  ).map(
                  (company) => ({
                    value: company.id,
                    label: company.name,
                  })
                )]}
                placeholder="Select contracting company"
              />

              <SelectInput
                label="Contractor Name"
                value={projectForm.contractorName}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    contractorName: value,
                    contractorId: "",
                  })
                }
                options={companyContacts.filter(
                  (contact) =>
                    contact.company_id === projectForm.contractingCompanyId &&
                    contact.active
                ).map(
                  (contact) => ({
                    value: contact.full_name,
                    label: contact.full_name,
                  })
                )}
                placeholder={projectForm.contractingCompanyId ? "Select contractor" : "Select contracting company first"}
              />

              <SelectInput
                label="Consultant Co"
                value={projectForm.consultantId}
                onChange={(value) => {
                  if (value === "__new_consultant_company__") {
                    openNewCustomer(true, "consultant");
                    return;
                  }
                  setProjectForm({
                    ...projectForm,
                    consultantId: value,
                    consultantName: "",
                  });
                }}
                options={[
                  { value: "__new_consultant_company__", label: "+ New Consultant Co" },
                  ...companies.filter(
                    (company) =>
                      company.customer_group === "consultant_company" &&
                      (company.active || company.id === projectForm.consultantId)
                  ).map(
                  (company) => ({
                    value: company.id,
                    label: company.name,
                  })
                )]}
                placeholder="Select consultant company"
              />

              <SelectInput
                label="Consultant Name"
                value={projectForm.consultantName}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    consultantName: value,
                  })
                }
                options={companyContacts.filter(
                  (contact) =>
                    contact.company_id === projectForm.consultantId &&
                    contact.active
                ).map(
                  (contact) => ({
                    value: contact.full_name,
                    label: contact.full_name,
                  })
                )}
                placeholder={projectForm.consultantId ? "Select consultant" : "Select consultant company first"}
              />

              <TextInput
                label="Mobile No."
                value={projectForm.mobileNo}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    mobileNo: value,
                  })
                }
                placeholder="07XXXXXXXX"
              />

              <DateInput
                label="Project Date"
                value={projectForm.projectDate}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    projectDate: value,
                  })
                }
              />

              <SelectInput
                label="Status"
                value={projectForm.statusId}
                onChange={(value) => {
                  const selectedStatus = statuses.find(
                    (status) => status.id === value
                  );
                  const isLost =
                    normalizeStatusGroup(selectedStatus?.name || "") === "lost";
                  setProjectForm({
                    ...projectForm,
                    statusId: value,
                    rejectionReason: isLost
                      ? projectForm.rejectionReason
                      : "",
                  });
                }}
                options={statuses.map(
                  (status) => ({
                    value: status.id,
                    label: status.name,
                  })
                )}
                placeholder="Select status"
              />

              <TextInput
                label="Estimated Cost (JD)"
                type="number"
                value={projectForm.estimatedCostJd}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    estimatedCostJd: value,
                  })
                }
                placeholder="0.00"
              />

              <SelectInput
                label="Assigned To"
                value={projectForm.assignedTo}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    assignedTo: value,
                  })
                }
                options={teamMembers
                  .filter((member) => member.active)
                  .map((member) => ({
                    value: member.id,
                    label: member.full_name,
                  }))}
                placeholder="Select salesperson"
              />

              <SelectInput
                label="Prepared By"
                value={projectForm.preparedBy}
                onChange={(value) =>
                  setProjectForm({
                    ...projectForm,
                    preparedBy: value,
                  })
                }
                options={[
                  ...teamMembers
                    .filter((member) => {
                      const name = member.full_name
                        .replaceAll(".", "")
                        .trim()
                        .toLowerCase();

                      return (
                        name === "eng reem hameed" ||
                        name === "rami al sebaie" ||
                        name === "rami al sebaei"
                      );
                    })
                    .map((member) => ({
                      value: member.id,
                      label: member.full_name,
                    })),
                  {
                    value: "__other__",
                    label: "Other",
                  },
                ]}
                placeholder="Select salesperson"
              />

              {projectForm.preparedBy === "__other__" && (
                <TextInput
                  label="Other Prepared By"
                  value={projectForm.preparedByOther}
                  onChange={(value) =>
                    setProjectForm({
                      ...projectForm,
                      preparedByOther: value,
                    })
                  }
                  placeholder="Enter full name"
                  required
                />
              )}
            </div>

            {projectForm.statusId &&
              projectForm.projectDate && (
                <AutomaticFollowUpHint
                  statusName={getStatusName(
                    projectForm.statusId
                  )}
                  projectDate={
                    projectForm.projectDate
                  }
                  followUpDate={getSuggestedFollowUpDate(
                    projectForm.projectDate,
                    projectForm.statusId
                  )}
                />
              )}

            <TextArea
              label="Notes"
              value={projectForm.notes}
              onChange={(value) =>
                setProjectForm({
                  ...projectForm,
                  notes: value,
                })
              }
              placeholder="Project notes..."
            />

            {normalizeStatusGroup(getStatusName(projectForm.statusId)) ===
              "lost" && (
              <>
                <SelectInput
                  label="Lost Reason"
                  value={
                    !projectForm.rejectionReason
                      ? ""
                      : LOST_REASON_OPTIONS.includes(
                          projectForm.rejectionReason as (typeof LOST_REASON_OPTIONS)[number]
                        )
                        ? projectForm.rejectionReason
                        : "__other__"
                  }
                  onChange={(value) =>
                    setProjectForm({
                      ...projectForm,
                      rejectionReason:
                        value === "__other__" ? "__other__" : value,
                    })
                  }
                  options={[
                    ...LOST_REASON_OPTIONS.map((reason) => ({
                      value: reason,
                      label: reason,
                    })),
                    { value: "__other__", label: "Other" },
                  ]}
                  placeholder="Select lost reason"
                />

                {projectForm.rejectionReason &&
                  !LOST_REASON_OPTIONS.includes(
                    projectForm.rejectionReason as (typeof LOST_REASON_OPTIONS)[number]
                  ) && (
                    <TextInput
                      label="Other Lost Reason"
                      value={
                        projectForm.rejectionReason === "__other__"
                          ? ""
                          : projectForm.rejectionReason
                      }
                      onChange={(value) =>
                        setProjectForm({
                          ...projectForm,
                          rejectionReason: value || "__other__",
                        })
                      }
                      placeholder="Enter the lost reason"
                      required
                    />
                  )}
              </>
            )}

            <TextArea
              label="Specification Mismatch"
              value={
                projectForm.specificationMismatch
              }
              onChange={(value) =>
                setProjectForm({
                  ...projectForm,
                  specificationMismatch:
                    value,
                })
              }
              placeholder="Enter specification mismatch..."
            />

            <div className="flex flex-col gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-3">
                {editingProjectId &&
                  (() => {
                    const editingProject = projects.find(
                      (project) => project.id === editingProjectId
                    );

                    if (!editingProject) return null;

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => openCopyProject(editingProject)}
                          disabled={saving || deletingProject}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Copy Project
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleProjectHidden(editingProject)}
                          disabled={saving || deletingProject}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium hover:bg-gray-100 disabled:opacity-50"
                        >
                          {editingProject.hidden
                            ? "Unhide Project"
                            : "Hide Project"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteProject(editingProject)}
                          disabled={saving || deletingProject}
                          className="rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingProject
                            ? "Deleting..."
                            : "Delete Project"}
                        </button>
                      </>
                    );
                  })()}
              </div>

              <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowProjectModal(false)
                }
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-3 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingProjectId
                    ? "Save Changes"
                    : copyingProject
                      ? "Save Copied Project"
                      : "Save Project"}
              </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {showCustomerModal && (
        <Modal
          maxWidth="max-w-xl"
          title={
            editingCustomerId
              ? "Edit Customer"
              : "Add Customer"
          }
          onClose={() => {
            if (!savingCustomer) {
              setShowCustomerModal(false);
            }
          }}
        >
          <form
            onSubmit={saveCustomer}
            className="space-y-5"
          >
            {customerFormError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {customerFormError}
              </div>
            )}

            <TextInput
              label={
                customerForm.customerGroup === "general_customer" &&
                customerForm.generalCustomerType === "person"
                  ? "Person Name"
                  : "Company Name"
              }
              value={customerForm.name}
              onChange={(value) =>
                setCustomerForm({
                  ...customerForm,
                  name: value,
                })
              }
              placeholder={
                customerForm.customerGroup === "general_customer" &&
                customerForm.generalCustomerType === "person"
                  ? "Person name"
                  : "Company name"
              }
              required
            />

            <SelectInput
              label="Customer Group"
              value={customerForm.customerGroup}
              onChange={(value) =>
                setCustomerForm({
                  ...customerForm,
                  customerGroup: value as CustomerForm["customerGroup"],
                })
              }
              options={[
                { value: "general_customer", label: "General Customer" },
                { value: "contracting_company", label: "Contracting Co" },
                { value: "consultant_company", label: "Consultant Co" },
              ]}
              placeholder="Select customer group"
            />

            {customerForm.customerGroup === "general_customer" && (
              <SelectInput
                label="General Customer Type"
                value={customerForm.generalCustomerType}
                onChange={(value) =>
                  setCustomerForm({
                    ...customerForm,
                    generalCustomerType: value as CustomerForm["generalCustomerType"],
                  })
                }
                options={[
                  { value: "company", label: "Company" },
                  { value: "person", label: "Person" },
                ]}
                placeholder="Select type"
              />
            )}

            <TextInput
              label="Phone"
              value={customerForm.phone}
              onChange={(value) =>
                setCustomerForm({
                  ...customerForm,
                  phone: value,
                })
              }
              placeholder="Phone number"
            />

            <TextInput
              label="Email"
              type="email"
              value={customerForm.email}
              onChange={(value) =>
                setCustomerForm({
                  ...customerForm,
                  email: value,
                })
              }
              placeholder="Email address"
            />

            <TextArea
              label="Notes"
              value={customerForm.notes}
              onChange={(value) =>
                setCustomerForm({
                  ...customerForm,
                  notes: value,
                })
              }
              placeholder="Customer notes..."
            />

            {customerForm.customerGroup !== "general_customer" && (
              <div className="space-y-4 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {customerForm.customerGroup === "contracting_company"
                        ? "Contractor Names"
                        : "Consultant Names"}
                    </h3>
                    <p className="text-sm text-gray-500">Add all people related to this company.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomerForm({
                        ...customerForm,
                        contacts: [
                          ...customerForm.contacts,
                          { fullName: "", phone: "", email: "" },
                        ],
                      })
                    }
                    className="rounded-lg border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                  >
                    + Add Name
                  </button>
                </div>

                {customerForm.contacts.length === 0 ? (
                  <p className="text-sm text-gray-500">No related names added yet.</p>
                ) : (
                  customerForm.contacts.map((contact, index) => (
                    <div key={contact.id || index} className="space-y-3 rounded-lg bg-gray-50 p-3">
                      <TextInput
                        label="Full Name"
                        value={contact.fullName}
                        onChange={(value) =>
                          setCustomerForm({
                            ...customerForm,
                            contacts: customerForm.contacts.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, fullName: value } : item
                            ),
                          })
                        }
                        placeholder="Full name"
                        required
                      />
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <TextInput
                          label="Mobile"
                          value={contact.phone}
                          onChange={(value) =>
                            setCustomerForm({
                              ...customerForm,
                              contacts: customerForm.contacts.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, phone: value } : item
                              ),
                            })
                          }
                          placeholder="Mobile number"
                        />
                        <TextInput
                          label="Email"
                          type="email"
                          value={contact.email}
                          onChange={(value) =>
                            setCustomerForm({
                              ...customerForm,
                              contacts: customerForm.contacts.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, email: value } : item
                              ),
                            })
                          }
                          placeholder="Email address"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomerForm({
                            ...customerForm,
                            contacts: customerForm.contacts.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove Name
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={() =>
                  setShowCustomerModal(false)
                }
                disabled={savingCustomer}
                className="rounded-lg border border-gray-300 px-5 py-3 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingCustomer}
                className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingCustomer
                  ? "Saving..."
                  : editingCustomerId
                    ? "Save Changes"
                    : "Save Customer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showFollowUpModal && (
        <Modal
          title={
            selectedProject
              ? `Add Follow-Up — ${
                  selectedProject.project_name ||
                  "Project"
                }`
              : "Add Follow-Up"
          }
          onClose={() => {
            if (!savingFollowUp) {
              setShowFollowUpModal(false);
            }
          }}
        >
          <form
            onSubmit={saveFollowUp}
            className="space-y-5"
          >
            <SelectInput
              label="Project"
              value={followUpForm.projectId}
              onChange={(value) => {
                const project = projects.find(
                  (item) => item.id === value
                );

                const suggestedDate = project
                  ? getSuggestedFollowUpDate(
                      project.project_date || "",
                      project.status_id || ""
                    )
                  : "";

                setFollowUpForm({
                  ...followUpForm,
                  projectId: value,
                  assignedTo:
                    project?.assigned_to ||
                    followUpForm.assignedTo,
                  followUpDate:
                    suggestedDate ||
                    followUpForm.followUpDate,
                });

                if (project) {
                  setSelectedProject(project);
                }
              }}
              options={projects
                .filter(
                  (project) => !project.hidden
                )
                .map((project) => ({
                  value: project.id,
                  label:
                    project.project_name ||
                    project.sn ||
                    "Unnamed Project",
                }))}
              placeholder="Select project"
            />

            <SelectInput
              label="Follow-Up Assigned To"
              value={followUpForm.assignedTo}
              onChange={(value) =>
                setFollowUpForm({
                  ...followUpForm,
                  assignedTo: value,
                })
              }
              options={teamMembers
                .filter((member) => member.active)
                .map((member) => ({
                  value: member.id,
                  label: member.full_name,
                }))}
              placeholder="Select salesperson"
            />

            {followUpForm.projectId && (
              <FollowUpQuickDates
                project={projects.find(
                  (project) =>
                    project.id ===
                    followUpForm.projectId
                )}
                value={followUpForm.followUpDate}
                onChange={(value) =>
                  setFollowUpForm({
                    ...followUpForm,
                    followUpDate: value,
                  })
                }
                getSuggestedFollowUpDate={
                  getSuggestedFollowUpDate
                }
              />
            )}

            <DateInput
              label="Follow-up Date"
              value={followUpForm.followUpDate}
              onChange={(value) =>
                setFollowUpForm({
                  ...followUpForm,
                  followUpDate: value,
                })
              }
            />

            <TextArea
              label="Notes"
              value={followUpForm.notes}
              onChange={(value) =>
                setFollowUpForm({
                  ...followUpForm,
                  notes: value,
                })
              }
              placeholder="What should you follow up about?"
            />

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={() =>
                  setShowFollowUpModal(false)
                }
                disabled={savingFollowUp}
                className="rounded-lg border border-gray-300 px-5 py-3 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingFollowUp}
                className="rounded-lg bg-orange-500 px-6 py-3 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {savingFollowUp
                  ? "Saving..."
                  : "Save Follow-Up"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDetailsModal && selectedProject && (
        <Modal
          title={
            selectedProject.project_name ||
            "Project Details"
          }
          onClose={() =>
            setShowDetailsModal(false)
          }
        >
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    selectedProject.hidden
                      ? "rounded-full bg-gray-200 px-3 py-1 text-sm text-gray-700"
                      : "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                  }
                >
                  {selectedProject.hidden
                    ? "Hidden"
                    : "Active"}
                </span>

                <span className="text-sm text-gray-500">
                  Project Date:{" "}
                  {formatDate(
                    selectedProject.project_date
                  )}
                </span>

                <StatusBadge
                  statusName={getStatusName(selectedProject.status_id)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailItem
                label="SN"
                value={selectedProject.sn}
              />

              <DetailItem
                label="Project Name"
                value={
                  selectedProject.project_name
                }
              />

              <DetailItem
                label="Customer"
                value={getCompanyName(
                  selectedProject.customer_id
                )}
              />

              <DetailItem
                label="Contracting Company"
                value={getCompanyName(
                  selectedProject.contracting_company_id
                )}
              />

              <DetailItem
                label="Contractor"
                value={getCompanyName(
                  selectedProject.contractor_id
                )}
              />

              <DetailItem
                label="Contractor Person"
                value={
                  selectedProject.contractor_name
                }
              />

              <DetailItem
                label="Consultant"
                value={getCompanyName(
                  selectedProject.consultant_id
                )}
              />

              <DetailItem
                label="Consultant Person"
                value={
                  selectedProject.consultant_name
                }
              />

              <DetailItem
                label="Mobile"
                value={
                  selectedProject.mobile_no
                }
              />

              <DetailItem
                label="Project Date"
                value={formatDate(
                  selectedProject.project_date
                )}
              />

              <DetailItem
                label="Status"
                value={
                  <StatusBadge
                    statusName={getStatusName(selectedProject.status_id)}
                  />
                }
              />

              <DetailItem
                label="Estimated Cost"
                value={
                  selectedProject.estimated_cost_jd === null
                    ? "-"
                    : `${selectedProject.estimated_cost_jd} JD`
                }
              />

              <DetailItem
                label="Assigned To"
                value={getTeamMemberName(
                  selectedProject.assigned_to
                )}
              />

              <DetailItem
                label="Prepared By"
                value={
                  selectedProject.prepared_by_other ||
                  getTeamMemberName(selectedProject.prepared_by)
                }
              />

              <DetailItem
                label="Next Follow-Up"
                value={
                  nextFollowUpForSelectedProject?.follow_up_date
                    ? formatDate(
                        nextFollowUpForSelectedProject.follow_up_date
                      )
                    : "No open follow-up"
                }
              />
            </div>

            {nextFollowUpForSelectedProject && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-sm font-medium text-orange-700">
                  Next Follow-Up
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {formatDate(
                    nextFollowUpForSelectedProject.follow_up_date
                  )}
                </p>

                <p className="mt-2 text-sm text-gray-700">
                  {nextFollowUpForSelectedProject.notes ||
                    "No notes"}
                </p>
              </div>
            )}

            <DetailText
              label="Notes"
              value={selectedProject.notes}
            />

            <DetailText
              label="Lost Reason"
              value={
                selectedProject.rejection_reason
              }
            />

            <DetailText
              label="Specification Mismatch"
              value={
                selectedProject.specification_mismatch
              }
            />

            <div>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">
                  Follow-ups
                </h3>
              </div>

              <ProjectFollowUps
                projectId={selectedProject.id}
                followUps={followUps}
                onToggle={toggleFollowUp}
                readOnly
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "mb-2 w-full rounded-lg bg-green-600 px-4 py-3 text-left text-white transition"
          : "mb-2 w-full rounded-lg px-4 py-3 text-left text-gray-300 transition hover:bg-gray-800"
      }
    >
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      }
    >
      {children}
    </button>
  );
}

function DashboardCard({
  title,
  value,
  onClick,
}: {
  title: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl bg-white p-6 text-left shadow-sm transition hover:shadow-md"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      {content}
    </div>
  );
}

function FollowUpSummaryCard({
  title,
  value,
  onClick,
}: {
  title: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-white p-6 text-left shadow-sm transition hover:shadow-md"
    >
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </button>
  );
}

function FollowUpStatus({
  completed,
}: {
  completed: boolean;
}) {
  return (
    <span
      className={
        completed
          ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
          : "rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700"
      }
    >
      {completed ? "Completed" : "Open"}
    </span>
  );
}

function AutomaticFollowUpHint({
  statusName,
  projectDate,
  followUpDate,
}: {
  statusName: string;
  projectDate: string;
  followUpDate: string;
}) {
  const days =
    AUTOMATIC_FOLLOW_UP_DAYS[
      statusName.trim().toLowerCase()
    ];

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      {days ? (
        <>
          <p className="font-semibold text-blue-800">
            Automatic First Follow-Up
          </p>

          <p className="mt-1 text-sm text-blue-700">
            {statusName} projects receive the first
            follow-up {days} days after the Project
            Date.
          </p>

          <p className="mt-2 font-medium text-blue-900">
            Project Date:{" "}
            {formatDate(projectDate)}
            {" → "}
            Follow-Up:{" "}
            {formatDate(followUpDate)}
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-gray-700">
            No Automatic Follow-Up
          </p>

          <p className="mt-1 text-sm text-gray-600">
            This status does not create an automatic
            first follow-up. You can still add one
            manually.
          </p>
        </>
      )}
    </div>
  );
}

function FollowUpQuickDates({
  project,
  value,
  onChange,
  getSuggestedFollowUpDate,
}: {
  project: Project | undefined;
  value: string;
  onChange: (value: string) => void;
  getSuggestedFollowUpDate: (
    projectDate: string,
    statusId: string
  ) => string;
}) {
  if (!project?.project_date) {
    return null;
  }

  const options = [
    { label: "+1 day", days: 1 },
    { label: "+3 days", days: 3 },
    { label: "+7 days", days: 7 },
    { label: "+14 days", days: 14 },
    { label: "+30 days", days: 30 },
  ];

  const automaticDate =
    project.status_id
      ? getSuggestedFollowUpDate(
          project.project_date,
          project.status_id
        )
      : "";

  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">
          Quick Follow-Up Date
        </p>

        <p className="mt-1 text-xs text-gray-500">
          Project Date:{" "}
          {formatDate(project.project_date)}
        </p>

        {automaticDate && (
          <p className="mt-1 text-xs font-medium text-blue-600">
            Status-based suggestion:{" "}
            {formatDate(automaticDate)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const date = addDaysToDate(
            project.project_date!,
            option.days
          );

          const active = value === date;

          return (
            <button
              key={option.days}
              type="button"
              onClick={() => onChange(date)}
              className={
                active
                  ? "rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100"
              }
            >
              {option.label}
            </button>
          );
        })}

        {automaticDate && (
          <button
            type="button"
            onClick={() =>
              onChange(automaticDate)
            }
            className={
              value === automaticDate
                ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            }
          >
            Status Date
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectFollowUps({
  projectId,
  followUps,
  onToggle,
  readOnly = false,
}: {
  projectId: string;
  followUps: FollowUp[];
  onToggle: (followUp: FollowUp) => void;
  readOnly?: boolean;
}) {
  const projectFollowUps = followUps
    .filter(
      (item) => item.project_id === projectId
    )
    .sort((a, b) => {
      if (!a.follow_up_date) return 1;
      if (!b.follow_up_date) return -1;

      return (
        new Date(
          `${a.follow_up_date}T00:00:00`
        ).getTime() -
        new Date(
          `${b.follow_up_date}T00:00:00`
        ).getTime()
      );
    });

  if (projectFollowUps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-gray-500">
        No follow-ups for this project yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      {projectFollowUps.map(
        (followUp) => (
          <div
            key={followUp.id}
            className="flex flex-col gap-4 border-b p-5 last:border-b-0 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">
                  {formatDate(
                    followUp.follow_up_date
                  )}
                </span>

                <FollowUpStatus
                  completed={
                    followUp.completed
                  }
                />

                {!followUp.completed &&
                  followUp.follow_up_date &&
                  followUp.follow_up_date <
                    getTodayString() && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                      Overdue
                    </span>
                  )}
              </div>

              <p className="mt-2 text-sm text-gray-600">
                {followUp.notes ||
                  "No notes"}
              </p>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => onToggle(followUp)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {followUp.completed
                  ? "Reopen"
                  : "Complete"}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function ProjectTable({
  projects,
  loading,
  getCompanyName,
  getStatusName,
  getProfileName,
  onCopy,
  onEdit,
  onDetails,
}: {
  projects: Project[];
  loading: boolean;
  getCompanyName: (
    id: string | null
  ) => string;
  getStatusName: (
    id: string | null
  ) => string;
  getProfileName: (
    id: string | null
  ) => string;
  onCopy: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDetails: (project: Project) => void;
}) {
  return (
    <div className="overflow-x-auto">
      {loading ? (
        <div className="p-10 text-center text-gray-500">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="p-10 text-center text-gray-500">
          No projects found.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="min-w-40 whitespace-nowrap px-6 py-4 text-left text-sm font-semibold">
                SN
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Project
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Project Date
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Customer
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Contracting
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Contractor
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Consultant
              </th>

              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold">
                Est. Cost (JD)
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Status
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold">
                Assigned To
              </th>

              <th className="px-6 py-4 text-right text-sm font-semibold">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className={
                  project.hidden
                    ? "border-t border-gray-100 bg-gray-50 hover:bg-gray-100"
                    : "border-t border-gray-100 hover:bg-gray-50"
                }
              >
                <td className="whitespace-nowrap px-6 py-4 font-medium">
                  {project.sn || "-"}
                </td>

                <td className="px-6 py-4 font-medium">
                  <div>
                    {project.project_name ||
                      "-"}
                  </div>

                  {project.hidden && (
                    <span className="mt-1 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                      Hidden
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                  {formatDate(
                    project.project_date
                  )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                  {getCompanyName(
                    project.customer_id
                  )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                  {getCompanyName(
                    project.contracting_company_id
                  )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                  <div>
                    {getCompanyName(
                      project.contractor_id
                    )}
                  </div>

                  {project.contractor_name && (
                    <div className="text-xs text-gray-400">
                      {project.contractor_name}
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 text-gray-600">
                  <div>
                    {getCompanyName(
                      project.consultant_id
                    )}
                  </div>

                  {project.consultant_name && (
                    <div className="text-xs text-gray-400">
                      {project.consultant_name}
                    </div>
                  )}
                </td>

                <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                  {project.estimated_cost_jd === null
                    ? "-"
                    : project.estimated_cost_jd.toLocaleString()}
                </td>

                <td className="px-6 py-4">
                  <StatusBadge
                    statusName={getStatusName(project.status_id)}
                  />
                </td>

                <td className="px-6 py-4 text-gray-600">
                  {getProfileName(
                    project.assigned_to
                  )}
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onCopy(project)
                      }
                      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Copy
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDetails(project)
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100"
                    >
                      Details
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onEdit(project)
                      }
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  maxWidth = "max-w-6xl",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`max-h-[94vh] w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-8 py-5">
          <h2 className="text-2xl font-bold">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-medium">
        {value || "-"}
      </p>
    </div>
  );
}

function DetailText({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-500">
        {label}
      </p>

      <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4">
        {value || "-"}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
