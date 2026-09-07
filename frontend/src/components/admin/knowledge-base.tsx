"use client";
import { useEffect, useMemo, useState } from "react";
import type { KbArticle, KbCategory } from "@/lib/types";
import {
  kbListArticles, kbCreateArticle, kbUpdateArticle, kbDeleteArticle,
  kbListCategoriesAdmin, kbCreateCategory, kbDeleteCategory, UnauthorizedError,
} from "@/lib/api";
import { CategoryIcon } from "@/lib/help-icons";
import { Markdown } from "@/components/help/markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, ExternalLink } from "lucide-react";

const STATUS_TABS = ["all", "published", "draft", "archived"] as const;
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  published: { bg: "#E4F3EA", fg: "#3E8E5A", label: "Published" },
  draft: { bg: "#FBF0DA", fg: "#B8791E", label: "Draft" },
  archived: { bg: "#ECE9EF", fg: "#7A7280", label: "Archived" },
};
const VISIBILITY = ["everyone", "agents", "teams"] as const;

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function KnowledgeBase({ query = "", onUnauthorized }: { query?: string; onUnauthorized: () => void }) {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [editing, setEditing] = useState<KbArticle | "new" | null>(null);
  const [showCats, setShowCats] = useState(false);

  function guard(e: unknown): boolean { if (e instanceof UnauthorizedError) { onUnauthorized(); return true; } return false; }

  async function load() {
    setLoading(true); setError("");
    try {
      const [arts, cats] = await Promise.all([kbListArticles(), kbListCategoriesAdmin()]);
      setArticles(arts); setCategories(cats);
    } catch (e) { if (!guard(e)) setError(e instanceof Error ? e.message : "Could not load the knowledge base."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const kpis = useMemo(() => [
    { label: "Total articles", value: articles.length, bg: "#f7b7d4" },
    { label: "Published", value: articles.filter((a) => a.status === "published").length, bg: "#c8e6d6" },
    { label: "Drafts", value: articles.filter((a) => a.status === "draft").length, bg: "#f6d6a5" },
    { label: "Categories", value: categories.length, bg: "#d8c6f7" },
  ], [articles, categories]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const byTab = statusTab === "all" || a.status === statusTab;
      const byQ = !q || a.title.toLowerCase().includes(q) || (a.body || "").toLowerCase().includes(q);
      return byTab && byQ;
    });
  }, [articles, statusTab, query]);

  async function onDelete(a: KbArticle) {
    try { await kbDeleteArticle(a.id); setArticles((x) => x.filter((y) => y.id !== a.id)); setEditing(null); }
    catch (e) { if (!guard(e)) setError(e instanceof Error ? e.message : "Could not delete."); }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f4f8]">
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-[22px] sm:px-6">
        <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-0.5 text-lg font-semibold text-foreground">Knowledge Base</h2>
            <p className="text-[13.5px] text-muted-foreground">Write and publish the help articles customers see at /help.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCats(true)}>Manage categories</Button>
            <Button variant="brand" size="sm" onClick={() => setEditing("new")}>+ New article</Button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3.5">
          {kpis.map((k) => (
            <Card key={k.label} className="min-w-[150px] flex-[1_0_150px] rounded-2xl border border-[#efe6ee] p-[16px_18px] shadow-none">
              <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
              <div className="text-2xl font-bold text-foreground">{k.value}</div>
              <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((f) => {
            const active = statusTab === f;
            return <button key={f} onClick={() => setStatusTab(f)} className={cn("rounded-full border px-3.5 py-2 text-[13px] capitalize cursor-pointer", active ? "sb-brand-gradient border-transparent font-semibold" : "border-border bg-white font-medium")}>{f}</button>;
          })}
        </div>

        {error && <p className="mb-3.5 text-destructive">{error}</p>}

        <Card className="overflow-x-auto rounded-2xl border border-[#efe6ee] shadow-none">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow className="hover:bg-transparent">{["Article", "Category", "Status", "Visibility", "Views", "Helpful", "Updated", ""].map((h, i) => <TableHead key={i} className="px-4 py-3.5">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="py-7 text-center text-[13px] text-muted-foreground">Loading articles…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="py-7 text-center text-[13px] text-muted-foreground">{articles.length === 0 ? "No articles yet. Create your first one." : "No articles match."}</TableCell></TableRow>
              ) : rows.map((a) => {
                const s = STATUS_STYLE[a.status] ?? { bg: "#ECE9EF", fg: "#7A7280", label: a.status };
                return (
                  <TableRow key={a.id} onClick={() => setEditing(a)} className="cursor-pointer">
                    <TableCell className="px-4 py-3"><div className="max-w-[280px] truncate text-[13.5px] font-semibold text-foreground">{a.title}</div><div className="text-[11.5px] text-[#a0a0a0]">/{a.slug}</div></TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{a.category ? <span className="inline-flex items-center gap-1.5"><CategoryIcon name={a.category.icon} className="size-3.5 text-[#8a6c92]" />{a.category.name}</span> : "—"}</TableCell>
                    <TableCell className="px-4 py-3"><span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: s.bg, color: s.fg }}>{s.label}</span></TableCell>
                    <TableCell className="px-4 py-3 text-[13px] capitalize text-muted-foreground">{a.visibility}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-foreground">{a.views}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{a.feedback_count ? `${a.helpful_percent ?? 0}% (${a.feedback_count})` : "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{fmtDate(a.updated_at)}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-[#8a6c92]"><Pencil className="ml-auto size-4" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {editing && (
        <ArticleEditor
          article={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setArticles((x) => { const i = x.findIndex((y) => y.id === saved.id); if (i === -1) return [saved, ...x]; const n = [...x]; n[i] = saved; return n; });
            setEditing(null);
          }}
          onDelete={onDelete}
          onUnauthorized={onUnauthorized}
        />
      )}

      {showCats && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCats(false)}
          onChange={setCategories}
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  );
}

/* ------------------------------ Article editor ----------------------------- */

function ArticleEditor({ article, categories, onClose, onSaved, onDelete, onUnauthorized }: {
  article: KbArticle | null; categories: KbCategory[];
  onClose: () => void; onSaved: (a: KbArticle) => void; onDelete: (a: KbArticle) => void; onUnauthorized: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [category, setCategory] = useState<string>(article?.category_id ?? "none");
  const [status, setStatus] = useState(article?.status ?? "draft");
  const [visibility, setVisibility] = useState(article?.visibility ?? "everyone");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr("A title is required."); return; }
    setSaving(true); setErr("");
    const payload = { title: title.trim(), body, category: category === "none" ? null : category, status, visibility };
    try {
      const saved = article ? await kbUpdateArticle(article.id, payload) : await kbCreateArticle(payload);
      onSaved(saved);
    } catch (e2) { if (e2 instanceof UnauthorizedError) return onUnauthorized(); setErr(e2 instanceof Error ? e2.message : "Could not save."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{article ? "Edit article" : "New article"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2"><Label htmlFor="kb-title">Title</Label><Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How Ara suggests outfits" autoFocus /></div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="flex flex-col gap-2"><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No category</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2"><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2"><Label>Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITY.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Body (Markdown)</Label>
              <div className="flex gap-1 text-[12.5px]">
                <button type="button" onClick={() => setTab("write")} className={cn("rounded-md px-2 py-1 cursor-pointer", tab === "write" ? "bg-[#f0e6f4] font-semibold text-[#8a6c92]" : "text-muted-foreground")}>Write</button>
                <button type="button" onClick={() => setTab("preview")} className={cn("rounded-md px-2 py-1 cursor-pointer", tab === "preview" ? "bg-[#f0e6f4] font-semibold text-[#8a6c92]" : "text-muted-foreground")}>Preview</button>
              </div>
            </div>
            {tab === "write" ? (
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder={"Write with Markdown — # headings, **bold**, - lists, [links](https://…)"} className="resize-y font-mono text-[13px]" />
            ) : (
              <div className="min-h-[220px] rounded-xl border border-[#efe6ee] bg-white p-4">{body.trim() ? <Markdown>{body}</Markdown> : <span className="text-[13px] text-muted-foreground">Nothing to preview yet.</span>}</div>
            )}
          </div>

          {err && <p className="text-[13px] text-destructive">{err}</p>}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              {article && (
                confirmDel ? (
                  <>
                    <span className="text-[13px] text-destructive">Delete permanently?</span>
                    <Button type="button" variant="outline" size="sm" className="border-[#f0c3d2] text-destructive" onClick={() => onDelete(article)}>Yes, delete</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDel(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="size-4" /> Delete</Button>
                )
              )}
              {article && article.status === "published" && (
                <a href={`/help/article/${article.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-[#8a6c92]"><ExternalLink className="size-3.5" /> View live</a>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="brand" disabled={saving}>{saving ? "Saving…" : article ? "Save changes" : "Create article"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Category manager ---------------------------- */

function CategoryManager({ categories, onClose, onChange, onUnauthorized }: {
  categories: KbCategory[]; onClose: () => void; onChange: (c: KbCategory[]) => void; onUnauthorized: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("book");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function guard(e: unknown): boolean { if (e instanceof UnauthorizedError) { onUnauthorized(); return true; } return false; }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("A name is required."); return; }
    setSaving(true); setErr("");
    try {
      const cat = await kbCreateCategory({ name: name.trim(), icon: icon.trim(), description: description.trim(), order: categories.length + 1 });
      onChange([...categories, cat]); setName(""); setDescription(""); setIcon("book");
    } catch (e2) { if (!guard(e2)) setErr(e2 instanceof Error ? e2.message : "Could not add category."); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    try { await kbDeleteCategory(id); onChange(categories.filter((c) => c.id !== id)); setConfirmId(null); }
    catch (e) { if (!guard(e)) setErr(e instanceof Error ? e.message : "Could not delete category."); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader><DialogTitle>Manage categories</DialogTitle></DialogHeader>

        <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No categories yet.</p>
          ) : categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#efe6ee] bg-white px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg sb-brand-gradient text-foreground"><CategoryIcon name={c.icon} className="size-4" /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-foreground">{c.name}</div><div className="truncate text-[11.5px] text-[#a0a0a0]">{c.article_count ?? 0} article{(c.article_count ?? 0) === 1 ? "" : "s"} · /{c.slug}</div></div>
              {confirmId === c.id ? (
                <>
                  <Button type="button" variant="outline" size="sm" className="border-[#f0c3d2] text-destructive" onClick={() => remove(c.id)}>Delete</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmId(c.id)} className="text-[#c08] cursor-pointer" title="Delete category"><Trash2 className="size-4 text-[#c47]" /></button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={add} className="mt-2 flex flex-col gap-3 border-t border-[#f0e6ec] pt-4">
          <div className="text-[13px] font-semibold text-foreground">Add a category</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
            <div className="flex flex-col gap-1.5"><Label htmlFor="cat-name">Name</Label><Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Getting Started" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="cat-icon">Icon</Label><Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="sparkles, shirt, wand…" /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="cat-desc">Description</Label><Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short line shown under the category" /></div>
          <div className="text-[11.5px] text-[#a0a0a0]">Icon names: sparkles, shirt, wand, credit-card, life-buoy, camera, user, settings, heart, shield, bell, book.</div>
          {err && <p className="text-[13px] text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Done</Button>
            <Button type="submit" variant="brand" disabled={saving}>{saving ? "Adding…" : "Add category"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
