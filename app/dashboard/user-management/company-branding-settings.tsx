"use client";

import {
  CalendarClockIcon,
  ImagePlusIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";

type BrandingVersion = {
  id: string;
  company_name: string;
  phone?: string | null;
  fax?: string | null;
  footer_text?: string | null;
  terms_html?: string | null;
  terms_text?: string | null;
  effective_from: string;
  effective_to?: string | null;
  has_logo?: boolean;
  logo_signed_url?: string | null;
  created_by_name?: string | null;
};

type BrandingResponse = {
  current: BrandingVersion | null;
  versions: BrandingVersion[];
  error: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function plainTextAsHtml(value: string | null | undefined) {
  if (!value) return "";
  return `<p>${value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>")}</p>`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Present";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

async function fetchBranding(): Promise<BrandingResponse> {
  try {
    const response = await fetch("/api/org/quotation-branding", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          current?: BrandingVersion | null;
          versions?: BrandingVersion[];
          error?: string;
        }
      | null;
    if (!response.ok) {
      return {
        current: null,
        versions: [],
        error: payload?.error ?? "Unable to load company branding.",
      };
    }
    return {
      current: payload?.current ?? null,
      versions: payload?.versions ?? [],
      error: null,
    };
  } catch {
    return {
      current: null,
      versions: [],
      error: "Unable to load company branding.",
    };
  }
}

export function CompanyBrandingSettings({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const [current, setCurrent] = useState<BrandingVersion | null>(null);
  const [versions, setVersions] = useState<BrandingVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [fax, setFax] = useState("");
  const [footerText, setFooterText] = useState("");
  const [termsHtml, setTermsHtml] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadBranding = useCallback(async () => {
    const result = await fetchBranding();
    setCurrent(result.current);
    setVersions(result.versions);
    setLoadError(result.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchBranding().then((result) => {
      if (cancelled) return;
      setCurrent(result.current);
      setVersions(result.versions);
      setLoadError(result.error);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function openEditor() {
    const defaults = current ?? versions[0] ?? null;
    setCompanyName(defaults?.company_name ?? "");
    setPhone(defaults?.phone ?? "");
    setFax(defaults?.fax ?? "");
    setFooterText(defaults?.footer_text ?? "");
    setTermsHtml(
      defaults?.terms_html || plainTextAsHtml(defaults?.terms_text),
    );
    setEffectiveFrom(today());
    setLogo(null);
    setRemoveLogo(false);
    setFileInputKey((key) => key + 1);
    setSaveError(null);
    setOpen(true);
  }

  async function saveVersion() {
    setIsSaving(true);
    setSaveError(null);
    const formData = new FormData();
    formData.set("company_name", companyName);
    formData.set("phone", phone);
    formData.set("fax", fax);
    formData.set("footer_text", footerText);
    formData.set("terms_html", termsHtml);
    formData.set("effective_from", effectiveFrom);
    formData.set("remove_logo", String(removeLogo));
    if (logo) formData.set("logo", logo);

    try {
      const response = await fetch("/api/org/quotation-branding", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!response.ok) {
        setSaveError(payload?.error ?? "Unable to create branding version.");
        return;
      }
      await loadBranding();
      setOpen(false);
      onMessage(
        payload?.message ?? "Company branding version created successfully.",
      );
    } catch {
      setSaveError("Unable to create branding version.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Company Branding</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Manage the organization identity and standard terms used by new
              customer quotations and work orders.
            </p>
          </div>
          <Button type="button" onClick={openEditor}>
            {versions.length ? (
              <PencilIcon className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {versions.length ? "Schedule New Branding" : "Add Branding"}
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-zinc-500">Loading company branding...</p>
        ) : loadError ? (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : current ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-5">
              {current.logo_signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${current.company_name} logo`}
                  className="max-h-28 max-w-full object-contain"
                  src={current.logo_signed_url}
                />
              ) : (
                <span className="text-sm text-zinc-500">No company logo</span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <BrandingField label="Company Name" value={current.company_name} />
              <BrandingField label="Phone" value={current.phone || "-"} />
              <BrandingField label="Fax" value={current.fax || "-"} />
              <BrandingField label="Footer" value={current.footer_text || "-"} />
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-zinc-500">
                  Terms and Conditions
                </p>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-800 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
                  {current.terms_html ? (
                    <div dangerouslySetInnerHTML={{ __html: current.terms_html }} />
                  ) : current.terms_text ? (
                    <p className="whitespace-pre-wrap">{current.terms_text}</p>
                  ) : (
                    <p className="text-zinc-500">Not configured</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 sm:col-span-2">
                Current version: {formatDate(current.effective_from)} –{" "}
                {formatDate(current.effective_to)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-md bg-zinc-50 p-4 text-sm text-zinc-600">
            No company branding has been configured yet.
          </p>
        )}
      </section>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => !isSaving && setOpen(nextOpen)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-xl sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Create a company branding version</DialogTitle>
            <DialogDescription>
              Choose when this version becomes active. Existing saved and generated
              documents retain their captured branding.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Effective From</Label>
                  <Input
                    className="mt-2"
                    type="date"
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                  />
                </div>
                <div>
                  <Label required>Company Name</Label>
                  <Input
                    className="mt-2"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    className="mt-2"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Fax</Label>
                  <Input
                    className="mt-2"
                    value={fax}
                    onChange={(event) => setFax(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Footer</Label>
                <Textarea
                  className="mt-2 min-h-24"
                  value={footerText}
                  onChange={(event) => setFooterText(event.target.value)}
                />
              </div>

              <div>
                <Label>Terms and Conditions</Label>
                <p className="mb-2 mt-1 text-xs text-zinc-500">
                  Use headings, emphasis, numbered lists, or bullet lists for long terms.
                </p>
                <RichTextEditor
                  value={termsHtml}
                  onChange={(html) => setTermsHtml(html)}
                />
              </div>

              <div className="rounded-lg border border-dashed border-zinc-300 p-4">
                <Label htmlFor="branding-logo">Company Logo</Label>
                <div className="mt-2 flex items-center gap-3">
                  <ImagePlusIcon className="size-5 text-zinc-500" />
                  <Input
                    accept="image/jpeg,image/png,image/webp"
                    id="branding-logo"
                    key={fileInputKey}
                    type="file"
                    onChange={(event) => {
                      setLogo(event.target.files?.[0] ?? null);
                      if (event.target.files?.[0]) setRemoveLogo(false);
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  JPEG, PNG, or WebP up to 5 MB. Leave empty to reuse the current logo.
                </p>
                {current?.has_logo ? (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={removeLogo}
                      onChange={(event) => {
                        setRemoveLogo(event.target.checked);
                        if (event.target.checked) {
                          setLogo(null);
                          setFileInputKey((key) => key + 1);
                        }
                      }}
                    />
                    Use no logo for this version
                  </label>
                ) : null}
              </div>
            </div>

            <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2">
                <CalendarClockIcon className="size-4" />
                <h3 className="font-semibold">Version History</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                End dates are calculated from the next scheduled version.
              </p>
              <div className="mt-4 space-y-3">
                {versions.map((version) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-white p-3"
                    key={version.id}
                  >
                    <p className="font-medium">{version.company_name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(version.effective_from)} – {formatDate(version.effective_to)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {version.has_logo ? "Logo included" : "No logo"} · {version.created_by_name || "System"}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          {saveError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}

          <DialogFooter showCloseButton={!isSaving}>
            <Button
              disabled={isSaving || !companyName.trim() || !effectiveFrom}
              type="button"
              onClick={() => void saveVersion()}
            >
              {isSaving ? "Creating..." : "Create Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BrandingField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-2 min-h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800">
        {value}
      </div>
    </div>
  );
}
