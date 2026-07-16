from __future__ import annotations

import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
PDF_PATH = OUT_DIR / "avyukta_crm_nextjs_code_guide.pdf"
MD_PATH = OUT_DIR / "avyukta_crm_nextjs_code_guide.md"


def clean(text: str) -> str:
    replacements = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def pdf_escape(text: str) -> str:
    return clean(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class SimplePDF:
    def __init__(self, title: str):
        self.title = title
        self.width = 612
        self.height = 792
        self.margin_x = 54
        self.margin_top = 58
        self.margin_bottom = 54
        self.content_width = self.width - self.margin_x * 2
        self.pages: list[list[str]] = []
        self.page_no = 0
        self.y = 0
        self._new_page()

    def _new_page(self) -> None:
        self.page_no += 1
        self.pages.append([])
        self.y = self.height - self.margin_top
        self._line(54, self.height - 42, self.width - 54, self.height - 42, 0.75, "CBD5E1")
        self._text(self.title, 54, self.height - 31, 8, "Helvetica", "64748B")
        self._text(f"Page {self.page_no}", self.width - 86, self.height - 31, 8, "Helvetica", "64748B")

    def _cmd(self, command: str) -> None:
        self.pages[-1].append(command)

    def _rgb(self, hex_color: str) -> str:
        value = hex_color.strip("#")
        r = int(value[0:2], 16) / 255
        g = int(value[2:4], 16) / 255
        b = int(value[4:6], 16) / 255
        return f"{r:.3f} {g:.3f} {b:.3f}"

    def _text(self, text: str, x: float, y: float, size: float, font: str, color: str = "111827") -> None:
        self._cmd(f"BT /{font} {size:.1f} Tf {self._rgb(color)} rg {x:.1f} {y:.1f} Td ({pdf_escape(text)}) Tj ET")

    def _line(self, x1: float, y1: float, x2: float, y2: float, width: float = 1, color: str = "E5E7EB") -> None:
        self._cmd(f"{self._rgb(color)} RG {width:.2f} w {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S")

    def _rect(self, x: float, y: float, width: float, height: float, fill: str = "FFFFFF", stroke: str = "E5E7EB") -> None:
        self._cmd(f"{self._rgb(fill)} rg {self._rgb(stroke)} RG 0.75 w {x:.1f} {y:.1f} {width:.1f} {height:.1f} re B")

    def ensure(self, needed: float) -> None:
        if self.y - needed < self.margin_bottom:
            self._new_page()

    def gap(self, amount: float) -> None:
        self.y -= amount

    def heading(self, text: str, level: int = 1) -> None:
        sizes = {1: 19, 2: 14, 3: 11.5}
        gaps = {1: 28, 2: 22, 3: 18}
        self.ensure(gaps[level] + 12)
        self.y -= 6 if level == 1 else 3
        self._text(text, self.margin_x, self.y, sizes[level], "Helvetica-Bold", "0F172A")
        self.y -= gaps[level]
        if level == 1:
            self._line(self.margin_x, self.y + 12, self.width - self.margin_x, self.y + 12, 1, "CBD5E1")

    def paragraph(self, text: str, size: float = 9.5, color: str = "1F2937", indent: float = 0) -> None:
        chars = max(28, int((self.content_width - indent) / (size * 0.50)))
        for raw in clean(text).split("\n"):
            lines = textwrap.wrap(raw, width=chars) or [""]
            for line in lines:
                self.ensure(size + 7)
                self._text(line, self.margin_x + indent, self.y, size, "Helvetica", color)
                self.y -= size + 4
        self.y -= 3

    def bullet(self, text: str, size: float = 9.2) -> None:
        self.ensure(18)
        self._text("-", self.margin_x + 4, self.y, size, "Helvetica-Bold", "334155")
        self.paragraph(text, size=size, indent=16)

    def code(self, text: str, size: float = 7.3) -> None:
        lines: list[str] = []
        max_chars = int((self.content_width - 18) / (size * 0.58))
        for raw in clean(text).strip("\n").split("\n"):
            if len(raw) <= max_chars:
                lines.append(raw)
            else:
                lines.extend(textwrap.wrap(raw, width=max_chars, subsequent_indent="  "))
        block_height = len(lines) * (size + 3) + 14
        self.ensure(block_height + 8)
        top = self.y + 4
        self._rect(self.margin_x, top - block_height, self.content_width, block_height, "F8FAFC", "CBD5E1")
        cursor = top - 13
        for line in lines:
            self._text(line, self.margin_x + 9, cursor, size, "Courier", "0F172A")
            cursor -= size + 3
        self.y = top - block_height - 10

    def table(self, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
        x0 = self.margin_x
        row_h = 22
        col_widths = [self.content_width * w for w in widths]
        self.ensure(row_h * (len(rows) + 1) + 16)
        self._rect(x0, self.y - row_h + 6, self.content_width, row_h, "E2E8F0", "CBD5E1")
        x = x0 + 6
        for header, col_w in zip(headers, col_widths):
            self._text(header, x, self.y - 8, 7.8, "Helvetica-Bold", "0F172A")
            x += col_w
        self.y -= row_h
        for row in rows:
            row_lines = []
            max_lines = 1
            for cell, col_w in zip(row, col_widths):
                width_chars = max(10, int((col_w - 8) / 4.2))
                lines = textwrap.wrap(clean(cell), width=width_chars) or [""]
                row_lines.append(lines)
                max_lines = max(max_lines, len(lines))
            height = max(row_h, max_lines * 10 + 10)
            self.ensure(height + 12)
            self._rect(x0, self.y - height + 6, self.content_width, height, "FFFFFF", "E5E7EB")
            x = x0 + 6
            for lines, col_w in zip(row_lines, col_widths):
                yy = self.y - 8
                for line in lines[:5]:
                    self._text(line, x, yy, 7.4, "Helvetica", "1F2937")
                    yy -= 9.5
                x += col_w
            self.y -= height
        self.y -= 10

    def save(self, path: Path) -> None:
        objects: list[bytes] = []
        font_names = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier"]
        font_ids = {}
        for name in font_names:
            font_ids[name] = len(objects) + 1
            objects.append(f"<< /Type /Font /Subtype /Type1 /BaseFont /{name} >>".encode("latin-1"))

        page_ids = []
        content_ids = []
        for page in self.pages:
            stream = ("\n".join(page) + "\n").encode("latin-1", errors="replace")
            content_ids.append(len(objects) + 1)
            objects.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream")
            page_ids.append(len(objects) + 1)
            objects.append(b"")

        pages_id = len(objects) + 1
        catalog_id = pages_id + 1
        font_resource = " ".join(f"/{name} {font_ids[name]} 0 R" for name in font_names)
        for i, page_id in enumerate(page_ids):
            objects[page_id - 1] = (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {self.width} {self.height}] "
                f"/Resources << /Font << {font_resource} >> >> "
                f"/Contents {content_ids[i]} 0 R >>"
            ).encode("latin-1")
        kids = " ".join(f"{pid} 0 R" for pid in page_ids)
        objects.append(f"<< /Type /Pages /Kids [ {kids} ] /Count {len(page_ids)} >>".encode("latin-1"))
        objects.append(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("latin-1"))

        data = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(data))
            data.extend(f"{index} 0 obj\n".encode("latin-1"))
            data.extend(obj)
            data.extend(b"\nendobj\n")
        xref = len(data)
        data.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
        for offset in offsets[1:]:
            data.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
        data.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("latin-1")
        )
        path.write_bytes(data)


def markdown_content() -> str:
    return clean(
        """# Avyukta CRM Next.js Code Guide

Generated from the current repository state.

This guide is written for a beginner to Next.js, but it intentionally uses real technical terms: App Router, Server Component, Client Component, Route Handler, Supabase Auth, service role, cookie, schema, primary key, foreign key, and role-based access control.

## Important note about the database

The repository does not currently contain SQL migrations, a Prisma schema, or a Supabase schema dump. The database section is therefore an inferred schema based on the tables and columns used by the code. Before production, create real migrations and compare them with your Supabase dashboard.
"""
    )


def build_pdf() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MD_PATH.write_text(markdown_content(), encoding="utf-8")
    pdf = SimplePDF("Avyukta CRM Next.js Code Guide")

    pdf.heading("Avyukta CRM Next.js Code Guide", 1)
    pdf.paragraph("Generated from the current crm-protech repository. This document explains the codebase for a developer who is new to Next.js but wants to learn the correct technical vocabulary while reading the project.")
    pdf.paragraph("The app is a multi-organization CRM foundation. It has two login areas: normal organization users under /login and system-level super admins under /super-admin/login. Data and authentication are handled with Supabase.")

    pdf.heading("1. Big Picture", 1)
    pdf.bullet("Framework: Next.js 16.2.10 with the App Router. The App Router maps folders inside app/ to URL routes.")
    pdf.bullet("Language: TypeScript. TypeScript adds static types on top of JavaScript so mistakes can be caught earlier.")
    pdf.bullet("UI: React 19 components styled with Tailwind CSS 4 utility classes.")
    pdf.bullet("Backend: Next.js Route Handlers in app/api/.../route.ts. These are server-side HTTP endpoints.")
    pdf.bullet("Database and auth: Supabase Auth for users and Supabase Postgres tables for organizations, profiles, memberships, and super admins.")
    pdf.bullet("Access model: Super admins manage organizations. Organization admins manage employees. Employees can be accountant or sales users.")

    pdf.heading("2. Project Structure", 1)
    pdf.code(
        """
app/
  layout.tsx                         Root HTML shell and global fonts
  page.tsx                           Default create-next-app landing page
  login/page.tsx                     Organization user login form
  forgot-password/page.tsx           Password reset request form
  auth/reset-password/page.tsx       Password update form after reset link
  dashboard/                         Organization dashboard area
  super-admin/                       Super admin login and dashboard area
  api/                               Server-only JSON endpoints
lib/
  supabase/                          Supabase client factories
  auth/                              Server-side session and role helpers
output/pdf/                          Generated documentation files
"""
    )
    pdf.paragraph("In Next.js App Router projects, folders define route segments. A file named page.tsx creates a page for that route. A file named layout.tsx wraps child pages. A file named route.ts creates an API endpoint instead of a visual page.")

    pdf.table(
        ["File convention", "Meaning in this project"],
        [
            ["app/layout.tsx", "Root Layout. It renders the html and body tags, uses the system font stack, and wraps every route."],
            ["app/dashboard/layout.tsx", "Protected layout for organization users. It verifies the session before rendering navigation."],
            ["app/api/.../route.ts", "Route Handler. Exports functions such as GET, POST, and PATCH to handle HTTP requests."],
            ["[id] folder", "Dynamic route segment. The value in the URL becomes context.params.id in the handler."],
            ["use client", "Directive that marks a component as a Client Component, allowing useState, useEffect, browser APIs, and event handlers."],
        ],
        [0.28, 0.72],
    )

    pdf.heading("3. Beginner Next.js Concepts", 1)
    pdf.heading("App Router", 2)
    pdf.paragraph("The App Router is Next.js's file-system router built on React Server Components. In this app, /dashboard exists because app/dashboard/page.tsx exists. /api/auth/login exists because app/api/auth/login/route.ts exists.")
    pdf.heading("Server Component", 2)
    pdf.paragraph("A Server Component runs on the server by default. It can read server-only data and call secure helpers. Example: app/dashboard/layout.tsx calls verifyOrgSession() before rendering.")
    pdf.heading("Client Component", 2)
    pdf.paragraph("A Client Component runs in the browser after hydration. It can use useState, useEffect, form events, fetch from the browser, and next/navigation's useRouter(). Any file starting with \"use client\" is a Client Component.")
    pdf.heading("Hydration", 2)
    pdf.paragraph("Hydration is React attaching browser-side behavior to HTML that was initially rendered by the server. Forms such as app/login/page.tsx need hydration because they track state and submit with JavaScript.")
    pdf.heading("Route Handler", 2)
    pdf.paragraph("A Route Handler is the backend part of a Next.js app. It receives Request objects and returns Response objects. This project uses NextResponse.json() to return JSON to client forms.")
    pdf.heading("Redirect", 2)
    pdf.paragraph("The redirect() function from next/navigation is used in Server Components to stop rendering and send the user to another route. Protected layouts redirect unauthenticated users to login pages.")

    pdf.heading("4. Component and Type Structure", 1)
    pdf.paragraph("This project does not use JavaScript class components. Modern React usually uses function components. When the user says class/structure, the important ideas here are components, TypeScript types, helper functions, and route handlers.")
    pdf.table(
        ["Construct", "Example", "Purpose"],
        [
            ["Function component", "LoginPage()", "Returns JSX that describes UI."],
            ["Type alias", "type LoginBody", "Documents the expected shape of request JSON."],
            ["Helper function", "jsonError()", "Avoids repeating response formatting."],
            ["Async server helper", "verifyOrgSession()", "Checks current Supabase user, org cookie, membership, and organization status."],
            ["State hook", "useState()", "Stores temporary browser UI state like email, password, loading, and error."],
            ["Effect hook", "useEffect()", "Runs browser-side side effects, such as loading organizations after page mount."],
        ],
        [0.25, 0.25, 0.50],
    )

    pdf.heading("5. Supabase Client Layers", 1)
    pdf.paragraph("The app intentionally has three Supabase client factories because browser code, server session code, and admin database code have different security needs.")
    pdf.table(
        ["File", "Runs where", "Uses", "What it can do"],
        [
            ["lib/supabase/client.ts", "Browser", "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY", "Password reset flows and browser-safe Supabase Auth calls."],
            ["lib/supabase/server.ts", "Server", "Anon key plus request cookies", "Reads/writes Supabase Auth session cookies in Route Handlers and Server Components."],
            ["lib/supabase/admin.ts", "Server only", "SUPABASE_SERVICE_ROLE_KEY", "Bypasses normal row-level restrictions. Used for trusted admin database operations and invitations."],
        ],
        [0.28, 0.17, 0.28, 0.27],
    )
    pdf.paragraph("Critical rule: never import createAdminClient() into a Client Component. The service role key is powerful and must never reach the browser.")

    pdf.heading("6. Authentication Flow", 1)
    pdf.heading("Organization user login", 2)
    pdf.code(
        """
Browser form: app/login/page.tsx
POST /api/auth/login
  1. Validate org_code, email, password.
  2. Sign in with Supabase Auth using email and password.
  3. Find active organization by org_code.
  4. Confirm user has active org_members row for that organization.
  5. Write httpOnly org_context cookie.
  6. Browser redirects to /dashboard.
"""
    )
    pdf.paragraph("The org_context cookie stores the selected organization. It is httpOnly, which means normal browser JavaScript cannot read it. That protects it from many client-side attacks.")
    pdf.heading("Super admin login", 2)
    pdf.code(
        """
Browser form: app/super-admin/login/page.tsx
POST /api/super-admin/auth/login
  1. Validate email and password.
  2. Sign in with Supabase Auth.
  3. Confirm user id exists in super_admins.
  4. Write httpOnly sa_context cookie.
  5. Browser redirects to /super-admin/dashboard.
"""
    )
    pdf.heading("Logout", 2)
    pdf.paragraph("POST /api/auth/logout signs out of Supabase Auth and clears both org_context and sa_context cookies. Both dashboards use their own SignOutButton, but they call the same endpoint.")

    pdf.heading("7. Protected Layouts", 1)
    pdf.paragraph("A layout can protect a whole section of the app. app/dashboard/layout.tsx calls verifyOrgSession(). If it returns null, redirect('/login') prevents the dashboard from rendering.")
    pdf.paragraph("app/super-admin/dashboard/layout.tsx calls verifySuperAdmin(). If the user is not a super admin, it redirects to /super-admin/login.")
    pdf.code(
        """
DashboardLayout
  verifyOrgSession()
    Supabase Auth getUser()
    read org_context cookie
    query org_members where user_id, org_id, status = active
    query organizations where id, status = active
    return session object used by layout and pages
"""
    )

    pdf.heading("8. API Route Reference", 1)
    pdf.table(
        ["Endpoint", "Method", "Who can call", "Main job"],
        [
            ["/api/auth/login", "POST", "Public form", "Sign in organization users and set org_context."],
            ["/api/auth/logout", "POST", "Signed-in users", "Sign out and clear context cookies."],
            ["/api/super-admin/auth/login", "POST", "Public super-admin form", "Sign in and confirm row in super_admins."],
            ["/api/super-admin/organizations", "GET", "Super admin", "List organizations ordered by name."],
            ["/api/super-admin/organizations", "POST", "Super admin", "Create organization, invite first admin, create profile, create membership."],
            ["/api/super-admin/organizations/[id]", "PATCH", "Super admin", "Update organization status."],
            ["/api/org/employees", "GET", "Org admin", "List members for current organization with embedded profile data."],
            ["/api/org/employees", "POST", "Org admin", "Invite employee, upsert profile, create membership."],
            ["/api/org/employees/[id]", "PATCH", "Org admin", "Update employee role or status in current organization."],
        ],
        [0.35, 0.10, 0.20, 0.35],
    )

    pdf.heading("9. UI Page Reference", 1)
    pdf.table(
        ["Page", "Component type", "What to study"],
        [
            ["/login", "Client Component", "Form state, fetch POST, error handling, router.replace()."],
            ["/forgot-password", "Client Component", "Browser Supabase client and resetPasswordForEmail()."],
            ["/auth/reset-password", "Client Component", "Reads URL hash tokens, creates Supabase session, updates password."],
            ["/dashboard", "Server Component", "Protected server render with current org session."],
            ["/dashboard/employees", "Server + Client", "Server page protects access, EmployeesClient handles browser table interactions."],
            ["/super-admin/dashboard", "Server Component", "Server-side counts using Promise.all()."],
            ["/super-admin/dashboard/organizations", "Client Component", "Loads organizations, creates organizations, updates status."],
        ],
        [0.30, 0.22, 0.48],
    )

    pdf.heading("10. Database Schema So Far", 1)
    pdf.paragraph("Because there are no migrations in the repository, this section describes the schema inferred from code. Use it as a learning reference and as a checklist for creating actual Supabase migrations.")
    pdf.heading("Entity relationship map", 2)
    pdf.code(
        """
auth.users
  1-to-1 profiles
  1-to-many org_members

organizations
  1-to-many org_members

super_admins
  1-to-1 auth.users for system-level admins

org_members
  joins one user/profile to one organization
"""
    )
    pdf.heading("organizations", 2)
    pdf.table(
        ["Column", "Likely type", "Used by code", "Meaning"],
        [
            ["id", "uuid primary key", "insert, select, eq", "Organization identifier generated with crypto.randomUUID()."],
            ["name", "text not null", "insert, list, display", "Human-readable company or tenant name."],
            ["org_code", "text unique", "login lookup, create validation", "Lowercase alphanumeric tenant code entered at login."],
            ["status", "text", "active check, PATCH", "Allowed values in code: active, paused, deleted."],
            ["created_at", "timestamptz", "optional display", "Creation timestamp displayed in admin table if present."],
        ],
        [0.18, 0.22, 0.24, 0.36],
    )
    pdf.heading("profiles", 2)
    pdf.table(
        ["Column", "Likely type", "Used by code", "Meaning"],
        [
            ["id", "uuid primary key / FK auth.users.id", "upsert", "Application profile id matching Supabase Auth user id."],
            ["email", "text", "upsert, embedded select", "Display and lookup email copied from auth user."],
            ["full_name", "text", "upsert, embedded select", "Person name displayed in employee table."],
            ["status", "text", "upsert active", "Application-level profile status."],
        ],
        [0.18, 0.24, 0.24, 0.34],
    )
    pdf.heading("org_members", 2)
    pdf.table(
        ["Column", "Likely type", "Used by code", "Meaning"],
        [
            ["id", "uuid primary key", "insert, PATCH, list", "Membership record id."],
            ["user_id", "uuid FK", "membership lookup", "The Supabase Auth/profile user."],
            ["org_id", "uuid FK", "tenant scoping", "The organization this user belongs to."],
            ["role", "text", "authz and PATCH", "Allowed values currently: admin, accountant, sales. Employee invite only allows accountant or sales."],
            ["status", "text", "active login check, PATCH", "Allowed employee values: active, inactive. Active is required to log in."],
            ["created_at", "timestamptz", "optional display", "Displayed as member_since if present."],
        ],
        [0.17, 0.19, 0.24, 0.40],
    )
    pdf.heading("super_admins", 2)
    pdf.table(
        ["Column", "Likely type", "Used by code", "Meaning"],
        [
            ["id", "uuid primary key / FK auth.users.id", "login and verify", "A Supabase Auth user becomes a super admin if their id exists here."],
            ["email", "text", "verifySuperAdmin display", "Email shown in super admin layout."],
        ],
        [0.22, 0.28, 0.25, 0.25],
    )
    pdf.heading("auth.users", 2)
    pdf.paragraph("auth.users is managed by Supabase Auth. The code does not directly query it with SQL. Instead, it uses admin.auth.admin.listUsers() to find users and admin.auth.admin.inviteUserByEmail() to invite new users.")

    pdf.heading("11. Suggested SQL Migration Starting Point", 1)
    pdf.paragraph("This is a suggested starting point only. Review constraints, indexes, RLS policies, and status enums before production.")
    pdf.code(
        """
create table public.organizations (
  id uuid primary key,
  name text not null,
  org_code text not null unique,
  status text not null default 'active'
    check (status in ('active', 'paused', 'deleted')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin', 'accountant', 'sales')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create table public.super_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
"""
    )

    pdf.heading("12. Request and Data Flow Examples", 1)
    pdf.heading("Create organization", 2)
    pdf.code(
        """
SuperAdminOrganizationsPage
  handleCreate()
    fetch POST /api/super-admin/organizations
      verifySuperAdmin()
      validate body
      check org_code uniqueness
      insert organizations row
      find or invite first admin in Supabase Auth
      upsert profiles row
      insert org_members row with role = admin
    loadOrganizations()
"""
    )
    pdf.heading("Invite employee", 2)
    pdf.code(
        """
EmployeesClient
  handleInvite()
    fetch POST /api/org/employees
      verifyOrgSession()
      require session.role === 'admin'
      validate email, full_name, role
      find or invite Supabase Auth user
      upsert profiles row
      insert org_members row for current org
    loadEmployees()
"""
    )

    pdf.heading("13. Security Notes", 1)
    pdf.bullet("The service role key can bypass RLS and must stay server-only. The code comments in lib/supabase/admin.ts correctly warn about this.")
    pdf.bullet("httpOnly cookies protect org_context and sa_context from browser JavaScript. This reduces risk if a client-side script is compromised.")
    pdf.bullet("All organization-scoped employee updates include .eq('org_id', session.org_id), which prevents an org admin from editing another org's members by guessing an id.")
    pdf.bullet("Role checks happen in both pages and API routes. This is important because UI-only checks are not security.")
    pdf.bullet("Before production, add real SQL migrations and Row Level Security policies. Even if server routes use the service role, RLS helps protect future direct client queries.")

    pdf.heading("14. Technical Terms Glossary", 1)
    glossary = [
        ["API", "Application Programming Interface. In this app, JSON endpoints under /api."],
        ["App Router", "Next.js router where app/ folders become routes."],
        ["Client Component", "React component with \"use client\" that can run browser interactivity."],
        ["Server Component", "Default App Router component that renders on the server."],
        ["Route Handler", "Server endpoint file named route.ts exporting HTTP method functions."],
        ["Primary key", "Column or columns that uniquely identify each row."],
        ["Foreign key", "Column that points to a row in another table."],
        ["Unique constraint", "Database rule preventing duplicate values."],
        ["Service role", "Supabase key with elevated privileges. Server-only."],
        ["RBAC", "Role-Based Access Control: permissions based on roles like admin, accountant, sales."],
        ["RLS", "Row Level Security: database policies controlling which rows a user can access."],
        ["Hydration", "React process that makes server-rendered HTML interactive in the browser."],
        ["JSX", "Syntax that looks like HTML inside JavaScript/TypeScript and becomes React elements."],
        ["Hook", "React function like useState or useEffect for component behavior."],
    ]
    pdf.table(["Term", "Meaning"], glossary, [0.25, 0.75])

    pdf.heading("15. Recommended Next Learning Path", 1)
    pdf.bullet("First read app/layout.tsx, app/dashboard/layout.tsx, and app/super-admin/dashboard/layout.tsx to understand layouts and protected server rendering.")
    pdf.bullet("Then read app/login/page.tsx and app/api/auth/login/route.ts together. One is the browser form; the other is the server endpoint it calls.")
    pdf.bullet("Next study lib/supabase/client.ts, server.ts, and admin.ts. Understanding why there are three clients is key to secure Supabase apps.")
    pdf.bullet("Then read app/api/super-admin/organizations/route.ts. It has the fullest example of validation, database writes, Auth invitation, and membership creation.")
    pdf.bullet("Finally create SQL migrations matching the inferred schema. This will turn the code's implicit database contract into version-controlled infrastructure.")

    pdf.heading("16. Current Gaps To Track", 1)
    pdf.bullet("No database migration files are present yet.")
    pdf.bullet("The root app/page.tsx is still the default create-next-app landing page.")
    pdf.bullet("There are no automated tests yet for API routes, auth helpers, or role restrictions.")
    pdf.bullet("findAuthUserByEmail scans users through the Supabase Admin API; this works for small systems but may need a more direct lookup strategy as user count grows.")
    pdf.bullet("Organization status values include paused and deleted, but verifyOrgSession currently only allows active organizations.")

    pdf.save(PDF_PATH)


if __name__ == "__main__":
    build_pdf()
    print(PDF_PATH)
    print(MD_PATH)
