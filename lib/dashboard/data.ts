import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrgSession } from "@/lib/auth/verify-org-session";
import { numeric } from "@/lib/invoices/data";

import { dateInRange, type DashboardDateRange } from "./date-range";

type Row = Record<string, unknown>;

export type DashboardPerson = {
  id: string;
  name: string;
  quotes: number;
  quoteValue: number;
  poCount: number;
  poValue: number;
  winRate: number;
};

export type DashboardJob = {
  id: string;
  number: string;
  customer: string;
  project: string;
  poNumber: string;
  salesperson: string;
  salespersonId: string;
  status: string;
  startedAt: string | null;
  completionDate: string | null;
  amount: number;
};

export type DashboardInvoice = {
  id: string;
  number: string;
  customerId: string;
  customer: string;
  amount: number;
  date: string;
  status: string;
  daysOutstanding: number;
};

export type DashboardData = {
  totals: {
    customers: number;
    newCustomers: number;
    openQuoteCount: number;
    openQuoteValue: number;
    poCount: number;
    poValue: number;
    activeJobs: number;
    completedJobs: number;
    completedMonth: number;
    completedYear: number;
    readyToInvoiceCount: number;
    readyToInvoiceValue: number;
    invoiced: number;
    paid: number;
    outstanding: number;
    overdue: number;
    overdueCount: number;
    dueThisWeek: number;
    employees: number;
    workingToday: number;
    holidayToday: number;
    availableToday: number;
    scheduledJobs: number;
  };
  my: {
    quoteCount: number;
    quoteValue: number;
    openQuoteCount: number;
    poPending: number;
    poCount: number;
    poValue: number;
    activeJobs: number;
    winRate: number;
  };
  pipeline: Array<{ key: string; label: string; count: number; value: number }>;
  invoicePipeline: Array<{ key: string; label: string; count: number; value: number }>;
  salespeople: DashboardPerson[];
  activeJobs: DashboardJob[];
  readyJobs: DashboardJob[];
  outstandingInvoices: DashboardInvoice[];
  recentQuotes: Array<{ id: string; number: string; customer: string; salesperson: string; value: number; status: string; date: string }>;
  revisions: Array<{ id: string; poId: string; poNumber: string; customer: string; revision: number; original: number; revised: number; difference: number; date: string }>;
  activities: Array<{ id: string; description: string; href: string | null; date: string }>;
  notifications: Array<{ id: string; title: string; message: string | null; href: string | null; read: boolean; date: string }>;
  topCustomers: Array<{ id: string; name: string; value: number; outstanding: number }>;
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function dateDiffDays(from: string | null | undefined, to = new Date()) {
  if (!from) return 0;
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000));
}

function resultRows(result: { data?: unknown[] | null; error?: { message?: string } | null }, source: string) {
  if (result.error) {
    console.error(`Unable to load dashboard ${source}`, result.error.message);
    return [] as Row[];
  }
  return (result.data ?? []) as Row[];
}

export async function getDashboardData(
  admin: SupabaseClient,
  session: OrgSession,
  range: DashboardDateRange,
): Promise<DashboardData> {
  const orgId = session.org_id;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const monthStart = `${todayIso.slice(0, 7)}-01`;
  const yearStart = `${todayIso.slice(0, 4)}-01-01`;

  const [customersR, quotesR, jobsR, posR, allocationsR, invoicesR, completionsR, membersR, employeesR, eventsR, participantsR, revisionsR, activitiesR, notificationsR] =
    await Promise.all([
      admin.from("customers").select("id,company_name,customer_status,record_status,assigned_sales_rep_id,created_at").eq("org_id", orgId).neq("record_status", "deleted"),
      admin.from("quotations").select("id,quotation_number,quotation_series_id,revision_number,customer_id,sales_rep_id,status,quote_date,created_at,project_name,grand_total_before_tax,grand_total_after_tax").eq("org_id", orgId).order("revision_number", { ascending: false }),
      admin.from("jobs").select("id,customer_id,latest_accepted_quotation_id,job_number,job_status,salesperson_id,accepted_at,created_at,latest_work_completion_id").eq("org_id", orgId),
      admin.from("job_purchase_orders").select("id,customer_id,po_number,po_received_date,combined_po_total,current_po_total,created_at,current_revision_number").eq("org_id", orgId),
      admin.from("job_purchase_order_allocations").select("purchase_order_id,job_id,project_name_snapshot,total_po_amount").eq("org_id", orgId),
      admin.from("job_invoices").select("id,job_id,purchase_order_id,invoice_number,invoice_date,invoice_amount,status,sent_at,payment_date,created_at").eq("org_id", orgId),
      admin.from("job_work_completions").select("id,job_id,completion_date,completed_at,reopened_at").eq("org_id", orgId),
      admin.from("org_members").select("user_id,role,status").eq("org_id", orgId).eq("status", "active"),
      admin.from("employee_directory").select("id,system_user_id,employee_name,employee_role,employee_status").eq("org_id", orgId).eq("employee_status", "active"),
      admin.from("public_calendar_events").select("id,event_type,event_status,starts_at,ends_at,job_id").eq("org_id", orgId).eq("event_status", "scheduled").lte("starts_at", `${todayIso}T23:59:59.999Z`).gte("ends_at", `${todayIso}T00:00:00.000Z`),
      admin.from("public_calendar_event_participants").select("event_id,employee_id").eq("org_id", orgId),
      admin.from("job_purchase_order_revisions").select("id,purchase_order_id,revision_number,revision_date,previous_po_amount,revised_po_amount,difference_amount").eq("org_id", orgId).gt("revision_number", 0).order("revision_date", { ascending: false }).limit(8),
      admin.from("customer_activities").select("id,description,linked_record_type,linked_record_id,occurred_at").eq("org_id", orgId).order("occurred_at", { ascending: false }).limit(10),
      admin.from("crm_notifications").select("id,title,message,href,read_at,created_at").eq("org_id", orgId).eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(8),
    ]);

  const customers = resultRows(customersR, "customers");
  const quoteRows = resultRows(quotesR, "quotations");
  const latestBySeries = new Map<string, Row>();
  quoteRows.forEach((row) => {
    const seriesId = text(row.quotation_series_id, text(row.id));
    if (!latestBySeries.has(seriesId)) latestBySeries.set(seriesId, row);
  });
  const latestQuotes = Array.from(latestBySeries.values());
  const jobs = resultRows(jobsR, "jobs");
  const purchaseOrders = resultRows(posR, "purchase orders");
  const allocations = resultRows(allocationsR, "PO allocations");
  const invoices = resultRows(invoicesR, "invoices");
  const completions = resultRows(completionsR, "work completions").filter((row) => !row.reopened_at);
  const members = resultRows(membersR, "members");
  const employees = resultRows(employeesR, "employees");
  const events = resultRows(eventsR, "calendar");
  const participants = resultRows(participantsR, "calendar participants");
  const revisionRows = resultRows(revisionsR, "PO revisions");
  const activityRows = resultRows(activitiesR, "activity");
  const notificationRows = resultRows(notificationsR, "notifications");

  const profileIds = Array.from(new Set(members.map((member) => text(member.user_id, "")).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [], error: null };
  const profiles = resultRows(profilesResult, "profiles");
  const profileName = new Map(profiles.map((profile) => [text(profile.id), text(profile.full_name, text(profile.email, "Team member"))]));
  const customerById = new Map(customers.map((customer) => [text(customer.id), customer]));
  const quoteById = new Map(latestQuotes.map((quote) => [text(quote.id), quote]));
  const poById = new Map(purchaseOrders.map((po) => [text(po.id), po]));
  const jobById = new Map(jobs.map((job) => [text(job.id), job]));
  const completionByJob = new Map(completions.map((completion) => [text(completion.job_id), completion]));
  const allocationByJob = new Map(allocations.map((allocation) => [text(allocation.job_id), allocation]));
  const invoiceJobIds = new Set(invoices.map((invoice) => text(invoice.job_id)));

  const filteredQuotes = latestQuotes.filter((quote) => dateInRange(text(quote.quote_date, text(quote.created_at, "")), range));
  const filteredPOs = purchaseOrders.filter((po) => dateInRange(text(po.po_received_date, text(po.created_at, "")), range));
  const filteredInvoices = invoices.filter((invoice) => dateInRange(text(invoice.invoice_date, text(invoice.created_at, "")), range));
  const openStatuses = new Set(["draft", "pending_approval", "sent"]);
  const openQuotes = latestQuotes.filter((quote) => openStatuses.has(text(quote.status, "")));
  const activeJobs = jobs.filter((job) => job.job_status === "work_in_process");
  const completedJobs = jobs.filter((job) => job.job_status === "work_completed");
  const readyJobs = completedJobs.filter((job) => !invoiceJobIds.has(text(job.id)));
  const outstanding = invoices.filter((invoice) => invoice.status === "sent");
  const overdueInvoices = outstanding.filter((invoice) => dateDiffDays(text(invoice.sent_at, text(invoice.invoice_date, ""))) > 30);
  const dueThisWeekInvoices = outstanding.filter((invoice) => {
    const age = dateDiffDays(text(invoice.sent_at, text(invoice.invoice_date, "")));
    return age >= 23 && age <= 30;
  });

  const dashboardJobs = (rows: Row[]): DashboardJob[] => rows.map((job) => {
    const quote = quoteById.get(text(job.latest_accepted_quotation_id));
    const allocation = allocationByJob.get(text(job.id));
    const po = allocation ? poById.get(text(allocation.purchase_order_id)) : undefined;
    const completion = completionByJob.get(text(job.id));
    return {
      id: text(job.id),
      number: text(job.job_number, "Pending"),
      customer: text(customerById.get(text(job.customer_id))?.company_name, "Unknown customer"),
      project: text(allocation?.project_name_snapshot, text(quote?.project_name, "No project name")),
      poNumber: text(po?.po_number),
      salesperson: profileName.get(text(job.salesperson_id)) ?? "Unassigned",
      salespersonId: text(job.salesperson_id, ""),
      status: text(job.job_status),
      startedAt: typeof job.accepted_at === "string" ? job.accepted_at : null,
      completionDate: typeof completion?.completion_date === "string" ? completion.completion_date : null,
      amount: numeric(allocation?.total_po_amount ?? po?.current_po_total ?? po?.combined_po_total),
    };
  });

  const dashboardInvoices: DashboardInvoice[] = outstanding.map((invoice) => {
    const job = jobById.get(text(invoice.job_id));
    const customer = job ? customerById.get(text(job.customer_id)) : undefined;
    return {
      id: text(invoice.id), number: text(invoice.invoice_number), customerId: text(job?.customer_id),
      customer: text(customer?.company_name, "Unknown customer"), amount: numeric(invoice.invoice_amount),
      date: text(invoice.invoice_date, ""), status: text(invoice.status),
      daysOutstanding: dateDiffDays(text(invoice.sent_at, text(invoice.invoice_date, ""))),
    };
  }).sort((a, b) => b.daysOutstanding - a.daysOutstanding);

  const salesMembers = members.filter((member) => ["sales", "salesperson"].includes(text(member.role, "").toLowerCase()));
  const salespeople = salesMembers.map((member): DashboardPerson => {
    const id = text(member.user_id);
    const personQuotes = filteredQuotes.filter((quote) => quote.sales_rep_id === id);
    const won = personQuotes.filter((quote) => ["accepted", "converted_to_work_order"].includes(text(quote.status, "")));
    const personJobs = jobs.filter((job) => job.salesperson_id === id);
    const personJobIds = new Set(personJobs.map((job) => text(job.id)));
    const personAllocations = allocations.filter((allocation) => personJobIds.has(text(allocation.job_id)) && filteredPOs.some((po) => po.id === allocation.purchase_order_id));
    return {
      id, name: profileName.get(id) ?? "Salesperson", quotes: personQuotes.length,
      quoteValue: personQuotes.reduce((sum, quote) => sum + numeric(quote.grand_total_after_tax ?? quote.grand_total_before_tax), 0),
      poCount: new Set(personAllocations.map((allocation) => text(allocation.purchase_order_id))).size,
      poValue: personAllocations.reduce((sum, allocation) => sum + numeric(allocation.total_po_amount), 0),
      winRate: personQuotes.length ? Math.round((won.length / personQuotes.length) * 100) : 0,
    };
  }).sort((a, b) => b.quoteValue - a.quoteValue);

  const myQuotes = filteredQuotes.filter((quote) => quote.sales_rep_id === session.user.id);
  const myWon = myQuotes.filter((quote) => ["accepted", "converted_to_work_order"].includes(text(quote.status, "")));
  const myJobs = jobs.filter((job) => job.salesperson_id === session.user.id);
  const myJobIds = new Set(myJobs.map((job) => text(job.id)));
  const myAllocations = allocations.filter((allocation) => myJobIds.has(text(allocation.job_id)) && filteredPOs.some((po) => po.id === allocation.purchase_order_id));

  const pipelineStages = [
    ["draft", "Draft"], ["pending_approval", "Follow-up"], ["sent", "PO Pending"], ["accepted", "PO Received"],
  ] as const;
  const pipelineSource = ["sales", "salesperson"].includes(session.role.toLowerCase()) ? myQuotes : filteredQuotes;
  const pipeline = pipelineStages.map(([key, label]) => {
    const rows = pipelineSource.filter((quote) => quote.status === key);
    return { key, label, count: rows.length, value: rows.reduce((sum, row) => sum + numeric(row.grand_total_after_tax ?? row.grand_total_before_tax), 0) };
  });

  const readyValue = readyJobs.reduce((sum, job) => sum + numeric(allocationByJob.get(text(job.id))?.total_po_amount), 0);
  const paidInvoices = filteredInvoices.filter((invoice) => invoice.status === "payment_received");
  const invoicePipeline = [
    { key: "ready", label: "Ready", count: readyJobs.length, value: readyValue },
    ...["draft", "sent", "payment_received"].map((key) => {
      const rows = key === "sent" ? outstanding : filteredInvoices.filter((invoice) => invoice.status === key);
      return { key, label: key === "payment_received" ? "Paid" : key[0].toUpperCase() + key.slice(1), count: rows.length, value: rows.reduce((sum, row) => sum + numeric(row.invoice_amount), 0) };
    }),
    { key: "overdue", label: "Overdue", count: overdueInvoices.length, value: overdueInvoices.reduce((sum, row) => sum + numeric(row.invoice_amount), 0) },
  ];

  const holidayEventIds = new Set(events.filter((event) => event.event_type === "employee_holiday").map((event) => text(event.id)));
  const jobEventIds = new Set(events.filter((event) => event.event_type === "job_site_assignment").map((event) => text(event.id)));
  const holidayEmployeeIds = new Set(participants.filter((row) => holidayEventIds.has(text(row.event_id))).map((row) => text(row.employee_id)));
  const workingEmployeeIds = new Set(participants.filter((row) => jobEventIds.has(text(row.event_id))).map((row) => text(row.employee_id)));

  const customerTotals = new Map<string, { id: string; name: string; value: number; outstanding: number }>();
  customers.forEach((customer) => customerTotals.set(text(customer.id), { id: text(customer.id), name: text(customer.company_name), value: 0, outstanding: 0 }));
  filteredPOs.forEach((po) => { const item = customerTotals.get(text(po.customer_id)); if (item) item.value += numeric(po.current_po_total ?? po.combined_po_total); });
  dashboardInvoices.forEach((invoice) => { const item = customerTotals.get(invoice.customerId); if (item) item.outstanding += invoice.amount; });

  const activityHref = (row: Row) => {
    const id = text(row.linked_record_id, "");
    if (!id) return null;
    const type = text(row.linked_record_type, "");
    if (type === "quotation") return `/dashboard/quotations/${id}`;
    if (type === "customer") return `/dashboard/customers/${id}`;
    if (type === "job") return `/dashboard/jobs/${id}`;
    return null;
  };

  return {
    totals: {
      customers: customers.length,
      newCustomers: customers.filter((row) => dateInRange(text(row.created_at, ""), range)).length,
      openQuoteCount: openQuotes.length,
      openQuoteValue: openQuotes.reduce((sum, row) => sum + numeric(row.grand_total_after_tax ?? row.grand_total_before_tax), 0),
      poCount: filteredPOs.length,
      poValue: filteredPOs.reduce((sum, row) => sum + numeric(row.current_po_total ?? row.combined_po_total), 0),
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      completedMonth: completions.filter((row) => text(row.completion_date, "") >= monthStart).length,
      completedYear: completions.filter((row) => text(row.completion_date, "") >= yearStart).length,
      readyToInvoiceCount: readyJobs.length,
      readyToInvoiceValue: readyValue,
      invoiced: filteredInvoices.reduce((sum, row) => sum + numeric(row.invoice_amount), 0),
      paid: paidInvoices.reduce((sum, row) => sum + numeric(row.invoice_amount), 0),
      outstanding: outstanding.reduce((sum, row) => sum + numeric(row.invoice_amount), 0),
      overdue: overdueInvoices.reduce((sum, row) => sum + numeric(row.invoice_amount), 0),
      overdueCount: overdueInvoices.length,
      dueThisWeek: dueThisWeekInvoices.reduce((sum, row) => sum + numeric(row.invoice_amount), 0),
      employees: employees.length,
      workingToday: workingEmployeeIds.size,
      holidayToday: holidayEmployeeIds.size,
      availableToday: Math.max(0, employees.length - new Set([...workingEmployeeIds, ...holidayEmployeeIds]).size),
      scheduledJobs: jobEventIds.size,
    },
    my: {
      quoteCount: myQuotes.length,
      quoteValue: myQuotes.reduce((sum, row) => sum + numeric(row.grand_total_after_tax ?? row.grand_total_before_tax), 0),
      openQuoteCount: myQuotes.filter((row) => openStatuses.has(text(row.status, ""))).length,
      poPending: latestQuotes.filter((row) => row.sales_rep_id === session.user.id && row.status === "sent").length,
      poCount: new Set(myAllocations.map((row) => text(row.purchase_order_id))).size,
      poValue: myAllocations.reduce((sum, row) => sum + numeric(row.total_po_amount), 0),
      activeJobs: myJobs.filter((job) => job.job_status === "work_in_process").length,
      winRate: myQuotes.length ? Math.round((myWon.length / myQuotes.length) * 100) : 0,
    },
    pipeline,
    invoicePipeline,
    salespeople,
    activeJobs: dashboardJobs(activeJobs).slice(0, 8),
    readyJobs: dashboardJobs(readyJobs).slice(0, 8),
    outstandingInvoices: dashboardInvoices.slice(0, 8),
    recentQuotes: latestQuotes.slice().sort((a, b) => text(b.created_at, "").localeCompare(text(a.created_at, ""))).slice(0, 8).map((quote) => ({
      id: text(quote.id), number: text(quote.quotation_number), customer: text(customerById.get(text(quote.customer_id))?.company_name, "Unknown customer"),
      salesperson: profileName.get(text(quote.sales_rep_id)) ?? "Unassigned", value: numeric(quote.grand_total_after_tax ?? quote.grand_total_before_tax),
      status: text(quote.status), date: text(quote.quote_date, ""),
    })),
    revisions: revisionRows.map((revision) => {
      const po = poById.get(text(revision.purchase_order_id));
      return { id: text(revision.id), poId: text(revision.purchase_order_id), poNumber: text(po?.po_number), customer: text(customerById.get(text(po?.customer_id))?.company_name, "Unknown customer"), revision: numeric(revision.revision_number), original: numeric(revision.previous_po_amount), revised: numeric(revision.revised_po_amount), difference: numeric(revision.difference_amount), date: text(revision.revision_date, "") };
    }),
    activities: activityRows.map((row) => ({ id: text(row.id), description: text(row.description), href: activityHref(row), date: text(row.occurred_at, "") })),
    notifications: notificationRows.map((row) => ({ id: text(row.id), title: text(row.title), message: typeof row.message === "string" ? row.message : null, href: typeof row.href === "string" ? row.href : null, read: Boolean(row.read_at), date: text(row.created_at, "") })),
    topCustomers: Array.from(customerTotals.values()).filter((row) => row.value > 0 || row.outstanding > 0).sort((a, b) => b.value - a.value).slice(0, 6),
  };
}
