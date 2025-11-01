"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  PlusCircle,
  FileText,
  Loader2,
  Trash2,
  Code,
  RefreshCw,
  Edit3,
  ExternalLink,
  Copy,
  BarChart3,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import Link from "next/link";
import { EmbedCodeDialog } from "@/components/embed-code-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Form {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  submissionCount: number;
  publicId?: string;
}

export default function FormsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [selectedFormForEmbed, setSelectedFormForEmbed] = useState<Form | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadForms();
    }
  }, [user]);

  async function loadForms() {
    try {
      setLoading(true);
      const response = await apiClient.getForms();
      setForms(response.forms || []);
    } catch (error) {
      console.error("Failed to load forms:", error);
      toast.error("Failed to load forms. Please sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function createNewForm() {
    try {
      const formData = {
        title: "Untitled Form",
        description: "",
        schema: {
          isMS: false,
          formElements: []
        }
      };

      const response = await apiClient.createForm(formData);
      toast.success("Form created successfully!");

      // Redirect to form builder with the new form ID
      router.push(`/form-builder?id=${response.form.id}`);
    } catch (error) {
      console.error("Failed to create form:", error);
      toast.error("Failed to create form. Please sign in.");
    }
  }

  async function deleteForm(formId: string) {
    if (!confirm("Are you sure you want to delete this form?")) return;

    try {
      await apiClient.deleteForm(formId);
      toast.success("Form deleted successfully");
      await loadForms();
    } catch (error) {
      console.error("Failed to delete form:", error);
      toast.error("Failed to delete form");
    }
  }

  async function publishForm(formId: string) {
    try {
      await apiClient.publishForm(formId);
      toast.success("Form published successfully!");
      await loadForms();
    } catch (error) {
      console.error("Failed to publish form:", error);
      toast.error("Failed to publish form");
    }
  }

  async function clearFormCache(formId: string) {
    try {
      await apiClient.clearFormCache(formId);
      toast.success("Cache cleared! The form will now show the latest version.");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Failed to clear cache");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
        <p className="mb-4">You need to sign in to manage forms</p>
        <Button asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
      </div>
    );
  }

  const publishedForms = forms.filter(f => f.status === 'published').length;
  const draftForms = forms.filter(f => f.status === 'draft').length;
  const totalSubmissions = forms.reduce((acc, f) => acc + f.submissionCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                My Forms
              </h1>
              <p className="text-muted-foreground text-lg">
                Create, manage, and analyze your forms in one place
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={createNewForm} size="lg" className="gap-2">
                <PlusCircle className="h-5 w-5" />
                Create Form
              </Button>
              <Button variant="outline" size="lg" asChild className="gap-2">
                <Link href="/ai-form-generator">
                  <Sparkles className="h-5 w-5" />
                  AI Generator
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {forms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Forms</p>
                      <p className="text-3xl font-bold">{forms.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {publishedForms} published
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-600" />
                      {draftForms} drafts
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                      <p className="text-3xl font-bold">{totalSubmissions}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Across all published forms
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Auto-Save</p>
                      <p className="text-3xl font-bold">Active</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Changes saved every 2 seconds
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Forms Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {forms.length === 0 ? (
            <Card className="col-span-full border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">No forms yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Create your first form to get started. Use our drag-and-drop builder or AI generator to build forms in minutes.
                </p>
                <div className="flex gap-3">
                  <Button onClick={createNewForm} size="lg">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create Your First Form
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="/ai-form-generator">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Try AI Generator
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            forms.map((form) => (
              <Card
                key={form.id}
                className={cn(
                  "group relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02] border-2",
                  form.status === 'published' && "border-green-200 dark:border-green-900"
                )}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <Badge
                    variant={form.status === 'published' ? 'default' : 'secondary'}
                    className={cn(
                      "font-medium",
                      form.status === 'published' && "bg-green-600 hover:bg-green-700",
                      form.status === 'draft' && "bg-yellow-600 hover:bg-yellow-700"
                    )}
                  >
                    {form.status === 'published' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {form.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                    {form.status}
                  </Badge>
                </div>

                <CardHeader className="pb-3">
                  <CardTitle className="line-clamp-1 text-xl pr-20">{form.title}</CardTitle>
                  {form.description && (
                    <CardDescription className="line-clamp-2 mt-2">
                      {form.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                      <span className="font-medium">{form.submissionCount}</span>
                      <span>submissions</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(form.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => router.push(`/form-builder?id=${form.id}`)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>

                    {form.status === 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => router.push(`/forms/${form.id}/submissions`)}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        View
                      </Button>
                    )}

                    {form.status === 'draft' && (
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => publishForm(form.id)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Publish
                      </Button>
                    )}

                    {/* More Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          ⋮
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {form.status === 'published' && form.publicId && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                const url = `${window.location.origin}/f/${form.publicId}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link copied to clipboard!");
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedFormForEmbed(form);
                                setEmbedDialogOpen(true);
                              }}
                            >
                              <Code className="h-4 w-4 mr-2" />
                              Embed Code
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(`/f/${form.publicId}`, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Form
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => clearFormCache(form.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Clear Cache
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => deleteForm(form.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Form
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Embed Code Dialog */}
        {selectedFormForEmbed && (
          <EmbedCodeDialog
            open={embedDialogOpen}
            onOpenChange={setEmbedDialogOpen}
            publicId={selectedFormForEmbed.publicId || ""}
            formTitle={selectedFormForEmbed.title}
          />
        )}
      </div>
    </div>
  );
}