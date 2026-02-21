import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Mail, RefreshCw } from "src/icons";
import trpc from "../../../api";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Spinner } from "../../../components/Spinner/Spinner";
import { Button, Input, Select } from "../../../components/ui";
import { useUserContext } from "../../../contexts/UserContext";
import "./EmailTemplates.scss";

type TemplateCategory = "transactional" | "automation" | "ops";

interface TemplateListItem {
  templateKey: string;
  label: string;
  description: string;
  category: TemplateCategory;
  tokens: string[];
  hasOverride: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedByUserId: number | null;
}

interface TemplateDetail {
  templateKey: string;
  label: string;
  description: string;
  category: TemplateCategory;
  tokens: string[];
  sampleVariables: Record<string, string>;
  defaultContent: {
    subject: string;
    html: string;
    text: string;
  };
  override: {
    enabled: boolean;
    subject: string | null;
    html: string | null;
    text: string | null;
    updatedAt: string;
    updatedByUserId: number | null;
  } | null;
  effectiveContent: {
    subject: string;
    html: string;
    text: string;
  };
}

interface TemplateEditorState {
  enabled: boolean;
  subject: string;
  html: string;
  text: string;
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  transactional: "Transaccional",
  automation: "Automation",
  ops: "Interno",
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    return trimmed || fallback;
  }
  return fallback;
};

const editorStateFromDetail = (detail: TemplateDetail): TemplateEditorState => ({
  enabled: detail.override?.enabled ?? true,
  subject: detail.override?.subject ?? detail.defaultContent.subject,
  html: detail.override?.html ?? detail.defaultContent.html,
  text: detail.override?.text ?? detail.defaultContent.text,
});

const isSameEditorState = (a: TemplateEditorState, b: TemplateEditorState): boolean =>
  a.enabled === b.enabled
  && a.subject === b.subject
  && a.html === b.html
  && a.text === b.text;

const stripUnsafePreviewScripts = (html: string): string =>
  (html || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

const sanitizePreviewHtml = (html: string): string => {
  const source = html || "";
  if (!source) return "";

  const fallback = stripUnsafePreviewScripts(source);

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return fallback;
  }

  try {
    const doc = new DOMParser().parseFromString(fallback, "text/html");
    doc.querySelectorAll("script").forEach((node) => node.remove());
    doc.querySelectorAll<HTMLElement>("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value.trim().toLowerCase();
        if (attrName.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }
        if (
          (attrName === "href" || attrName === "src" || attrName === "xlink:href")
          && attrValue.startsWith("javascript:")
        ) {
          node.removeAttribute(attr.name);
        }
      });
    });

    return doc.documentElement ? `<!doctype html>\n${doc.documentElement.outerHTML}` : fallback;
  } catch {
    return fallback;
  }
};

export function EmailTemplates() {
  const navigate = useNavigate();
  const { currentUser } = useUserContext();

  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [editor, setEditor] = useState<TemplateEditorState>({
    enabled: true,
    subject: "",
    html: "",
    text: "",
  });
  const [baselineEditor, setBaselineEditor] = useState<TemplateEditorState>({
    enabled: true,
    subject: "",
    html: "",
    text: "",
  });
  const [testEmail, setTestEmail] = useState<string>(currentUser?.email ?? "");
  const [sendDraft, setSendDraft] = useState<boolean>(true);
  const [previewMode, setPreviewMode] = useState<"draft" | "effective">("draft");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const setTemplateError = (message: string) => {
    setError(message);
    setSuccess("");
  };

  const setTemplateSuccess = (message: string) => {
    setSuccess(message);
    setError("");
  };

  const fetchTemplates = async () => {
    setLoadingList(true);
    try {
      const response = (await trpc.admin.emailTemplates.list.query()) as TemplateListItem[];
      const items = Array.isArray(response) ? response : [];
      setTemplates(items);
      setError("");

      if (!items.length) {
        setSelectedTemplateKey("");
        setDetail(null);
        return;
      }

      setSelectedTemplateKey((prev) => {
        if (prev && items.some((item) => item.templateKey === prev)) return prev;
        return items[0].templateKey;
      });
    } catch (cause) {
      setTemplateError(getErrorMessage(cause, "No se pudo cargar el listado de plantillas."));
      setTemplates([]);
      setDetail(null);
      setSelectedTemplateKey("");
    } finally {
      setLoadingList(false);
    }
  };

  const fetchTemplateDetail = async (templateKey: string) => {
    if (!templateKey) return;
    setLoadingDetail(true);
    try {
      const response = (await trpc.admin.emailTemplates.get.query({
        templateKey,
      })) as TemplateDetail;

      const nextEditor = editorStateFromDetail(response);
      setDetail(response);
      setEditor(nextEditor);
      setBaselineEditor(nextEditor);
      setError("");
    } catch (cause) {
      setTemplateError(getErrorMessage(cause, "No se pudo cargar el detalle de la plantilla."));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    void fetchTemplates();
  }, []);

  useEffect(() => {
    if (!selectedTemplateKey) return;
    void fetchTemplateDetail(selectedTemplateKey);
  }, [selectedTemplateKey]);

  useEffect(() => {
    if (currentUser?.email && !testEmail) {
      setTestEmail(currentUser.email);
    }
  }, [currentUser?.email, testEmail]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return templates.filter((item) => {
      if (category && item.category !== category) return false;
      if (!normalizedSearch) return true;

      const haystack = `${item.label} ${item.templateKey} ${item.description}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [templates, search, category]);

  const isDirty = useMemo(
    () => !isSameEditorState(editor, baselineEditor),
    [editor, baselineEditor],
  );

  const previewHtml = useMemo(() => {
    if (previewMode === "effective") {
      return detail?.effectiveContent?.html ?? "";
    }
    return editor.html;
  }, [detail?.effectiveContent?.html, editor.html, previewMode]);

  const previewHtmlSafe = useMemo(() => sanitizePreviewHtml(previewHtml), [previewHtml]);

  const startSelectTemplate = (templateKey: string) => {
    if (templateKey === selectedTemplateKey) return;
    setSuccess("");
    setSelectedTemplateKey(templateKey);
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await trpc.admin.emailTemplates.saveOverride.mutate({
        templateKey: detail.templateKey,
        enabled: editor.enabled,
        subject: editor.subject,
        html: editor.html,
        text: editor.text,
      });

      await Promise.all([
        fetchTemplates(),
        fetchTemplateDetail(detail.templateKey),
      ]);

      setTemplateSuccess("Plantilla guardada.");
    } catch (cause) {
      setTemplateError(getErrorMessage(cause, "No se pudo guardar la plantilla."));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!detail) return;

    const confirmed = window.confirm("Esto eliminará el override y restaurará la plantilla por defecto. ¿Continuar?");
    if (!confirmed) return;

    setResetting(true);
    try {
      await trpc.admin.emailTemplates.resetOverride.mutate({
        templateKey: detail.templateKey,
      });

      await Promise.all([
        fetchTemplates(),
        fetchTemplateDetail(detail.templateKey),
      ]);

      setTemplateSuccess("Override eliminado. La plantilla volvió a default.");
    } catch (cause) {
      setTemplateError(getErrorMessage(cause, "No se pudo resetear la plantilla."));
    } finally {
      setResetting(false);
    }
  };

  const handleRestoreDefaultField = (field: "subject" | "html" | "text") => {
    if (!detail) return;
    setEditor((prev) => ({
      ...prev,
      [field]: detail.defaultContent[field],
    }));
  };

  const handleSendTest = async () => {
    if (!detail) return;
    if (!testEmail.trim()) {
      setTemplateError("Escribe un email de destino para la prueba.");
      return;
    }

    setSendingTest(true);
    try {
      await trpc.admin.emailTemplates.sendTest.mutate({
        templateKey: detail.templateKey,
        toEmail: testEmail.trim(),
        useDraft: sendDraft,
        subject: sendDraft ? editor.subject : undefined,
        html: sendDraft ? editor.html : undefined,
        text: sendDraft ? editor.text : undefined,
      });
      setTemplateSuccess("Correo de prueba enviado.");
    } catch (cause) {
      setTemplateError(getErrorMessage(cause, "No se pudo enviar el correo de prueba."));
    } finally {
      setSendingTest(false);
    }
  };

  const toolbar = (
    <div className="email-templates-toolbar">
      <label className="email-templates-toolbar__field">
        <span>Buscar</span>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busca por nombre o key..."
        />
      </label>

      <label className="email-templates-toolbar__field">
        <span>Categoría</span>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Todas</option>
          <option value="transactional">Transaccional</option>
          <option value="automation">Automation</option>
          <option value="ops">Interno</option>
        </Select>
      </label>

      <Button unstyled
        type="button"
        className="btn-icon btn-secondary"
        onClick={() => {
          setSuccess("");
          setError("");
          void fetchTemplates();
        }}
      >
        <RefreshCw size={18} aria-hidden />
        Actualizar
      </Button>
    </div>
  );

  return (
    <AdminPageLayout
      title="Plantillas de email"
      subtitle="Edita HTML, texto y subject de las plantillas que usa el backend para envíos reales."
      toolbar={toolbar}
    >
      {loadingList ? (
        <div className="email-templates-state">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      ) : (
        <section className="email-templates-grid">
          <section className="email-templates-list admin-table-panel">
            <header className="email-templates-list__header">
              <h2>Templates</h2>
              <span>{filteredTemplates.length}</span>
            </header>

            {filteredTemplates.length === 0 ? (
              <p className="email-templates-list__empty">No hay plantillas para esos filtros.</p>
            ) : (
              <div className="email-templates-list__scroll" aria-label="Listado de templates">
                {filteredTemplates.map((item) => {
                  const isActive = item.templateKey === selectedTemplateKey;
                  return (
                    <button
                      key={item.templateKey}
                      type="button"
                      className={`email-templates-item${isActive ? " is-active" : ""}`}
                      onClick={() => startSelectTemplate(item.templateKey)}
                    >
                      <div className="email-templates-item__head">
                        <strong>{item.label}</strong>
                        <span className={`email-templates-pill is-${item.category}`}>
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </div>
                      <p className="email-templates-item__key">{item.templateKey}</p>
                      <p className="email-templates-item__description">{item.description}</p>
                      <div className="email-templates-item__meta">
                        <span>{item.hasOverride ? (item.enabled ? "Override activo" : "Override desactivado") : "Sin override"}</span>
                        <span>{formatDateTime(item.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="email-templates-editor admin-table-panel">
            {loadingDetail ? (
              <div className="email-templates-state">
                <Spinner size={3} width={0.3} color="var(--app-accent)" />
              </div>
            ) : !detail ? (
              <div className="email-templates-state">
                <p>Selecciona una plantilla para editarla.</p>
              </div>
            ) : (
              <>
                <header className="email-templates-editor__header">
                  <div>
                    <h2>{detail.label}</h2>
                    <p>{detail.templateKey}</p>
                  </div>
                  <div className="email-templates-editor__status">
                    {detail.override?.enabled ? (
                      <span className="email-templates-status is-enabled">
                        <CheckCircle2 size={16} />
                        Override activo
                      </span>
                    ) : detail.override ? (
                      <span className="email-templates-status is-disabled">Override desactivado</span>
                    ) : (
                      <span className="email-templates-status">Default</span>
                    )}
                  </div>
                </header>

                {error ? <p className="email-templates-message is-error">{error}</p> : null}
                {success ? <p className="email-templates-message is-success">{success}</p> : null}

                <div className="email-templates-form">
                  <label className="email-templates-checkbox">
                    <input
                      type="checkbox"
                      checked={editor.enabled}
                      onChange={(event) => setEditor((prev) => ({ ...prev, enabled: event.target.checked }))}
                    />
                    <span>Activar override</span>
                  </label>

                  <label className="email-templates-form__field">
                    <span>Subject</span>
                    <Input
                      value={editor.subject}
                      onChange={(event) => setEditor((prev) => ({ ...prev, subject: event.target.value }))}
                      placeholder="Asunto del correo"
                    />
                    <button
                      type="button"
                      className="email-templates-link"
                      onClick={() => handleRestoreDefaultField("subject")}
                    >
                      Restaurar default
                    </button>
                  </label>

                  <label className="email-templates-form__field">
                    <span>HTML</span>
                    <textarea
                      value={editor.html}
                      onChange={(event) => setEditor((prev) => ({ ...prev, html: event.target.value }))}
                      rows={16}
                    />
                    <button
                      type="button"
                      className="email-templates-link"
                      onClick={() => handleRestoreDefaultField("html")}
                    >
                      Restaurar default
                    </button>
                  </label>

                  <label className="email-templates-form__field">
                    <span>Texto plano</span>
                    <textarea
                      value={editor.text}
                      onChange={(event) => setEditor((prev) => ({ ...prev, text: event.target.value }))}
                      rows={8}
                    />
                    <button
                      type="button"
                      className="email-templates-link"
                      onClick={() => handleRestoreDefaultField("text")}
                    >
                      Restaurar default
                    </button>
                  </label>

                  <div className="email-templates-actions">
                    <Button unstyled
                      type="button"
                      className="btn-icon btn-primary"
                      disabled={saving || !isDirty}
                      onClick={() => void handleSave()}
                    >
                      Guardar cambios
                    </Button>
                    <Button unstyled
                      type="button"
                      className="btn-icon btn-secondary"
                      disabled={resetting || !detail.override}
                      onClick={() => void handleReset()}
                    >
                      {resetting ? "Reseteando..." : "Reset override"}
                    </Button>
                  </div>
                </div>

                <section className="email-templates-test">
                  <h2>Enviar prueba</h2>
                  <div className="email-templates-test__controls">
                    <label>
                      <span>Email destino</span>
                      <Input
                        value={testEmail}
                        onChange={(event) => setTestEmail(event.target.value)}
                        placeholder="email@dominio.com"
                        type="email"
                      />
                    </label>

                    <label className="email-templates-checkbox">
                      <input
                        type="checkbox"
                        checked={sendDraft}
                        onChange={(event) => setSendDraft(event.target.checked)}
                      />
                      <span>Usar borrador local</span>
                    </label>

                    <Button unstyled
                      type="button"
                      className="btn-icon btn-secondary"
                      disabled={sendingTest}
                      onClick={() => void handleSendTest()}
                    >
                      <Mail size={18} aria-hidden />
                      {sendingTest ? "Enviando..." : "Enviar test"}
                    </Button>
                  </div>
                </section>

                <section className="email-templates-preview">
                  <div className="email-templates-preview__head">
                    <h2>Vista previa</h2>
                    <div className="email-templates-preview__modes">
                      <button
                        type="button"
                        className={previewMode === "draft" ? "is-active" : ""}
                        onClick={() => setPreviewMode("draft")}
                      >
                        Borrador
                      </button>
                      <button
                        type="button"
                        className={previewMode === "effective" ? "is-active" : ""}
                        onClick={() => setPreviewMode("effective")}
                      >
                        Efectivo
                      </button>
                    </div>
                  </div>

                  <iframe
                    title="Preview template email"
                    className="email-templates-preview__frame"
                    srcDoc={previewHtmlSafe}
                    sandbox=""
                  />
                </section>

                <section className="email-templates-variables">
                  <h2>Tokens disponibles</h2>
                  <p>Usa formato <code>{"{{TOKEN}}"}</code>.</p>
                  <div className="email-templates-variables__chips">
                    {detail.tokens.map((token) => (
                      <span key={token}>{token}</span>
                    ))}
                  </div>
                  <details>
                    <summary>Ver variables de ejemplo</summary>
                    <pre>{JSON.stringify(detail.sampleVariables, null, 2)}</pre>
                  </details>
                </section>
              </>
            )}
          </div>
        </section>
      )}
    </AdminPageLayout>
  );
}
