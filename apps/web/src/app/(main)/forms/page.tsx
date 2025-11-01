"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { PlusCircle, FileText, Loader2, Trash2, Code, RefreshCw } from "lucide-react";
import Link from "next/link";
import { EmbedCodeDialog } from "@/components/embed-code-dialog";

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Forms (API)</h1>
        <p className="text-muted-foreground">
          Forms saved to the database with real-time auto-save
        </p>
      </div>

      <div className="mb-6">
        <Button onClick={createNewForm}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Form
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {forms.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first form to get started. Forms will be saved to the database.
              </p>
              <Button onClick={createNewForm}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Form
              </Button>
            </CardContent>
          </Card>
        ) : (
          forms.map((form) => (
            <Card key={form.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="line-clamp-1">{form.title}</CardTitle>
                {form.description && (
                  <CardDescription className="line-clamp-2">
                    {form.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`capitalize ${
                      form.status === 'published' ? 'text-green-600' :
                      form.status === 'draft' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {form.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submissions:</span>
                    <span>{form.submissionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      toast.info("Opening form editor...");
                      router.push(`/form-builder?id=${form.id}`);
                    }}
                  >
                    Edit
                  </Button>
                  {form.status === 'published' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/forms/${form.id}/submissions`)}
                    >
                      Submissions
                    </Button>
                  )}
                  {form.status === 'draft' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => publishForm(form.id)}
                    >
                      Publish
                    </Button>
                  )}
                  {form.status === 'published' && form.publicId && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const url = `${window.location.origin}/f/${form.publicId}`;
                          navigator.clipboard.writeText(url);
                          toast.success(`Form link copied: ${url}`);
                        }}
                      >
                        Copy Link
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedFormForEmbed(form);
                          setEmbedDialogOpen(true);
                        }}
                      >
                        <Code className="h-4 w-4 mr-1" />
                        Embed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearFormCache(form.id)}
                        title="Clear cache to force refresh the public form"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteForm(form.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">How to test the API integration:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Create New Form" - it will save to the database</li>
          <li>Forms are auto-saved every 2 seconds when editing</li>
          <li>Publish forms to get a shareable link</li>
          <li>All forms are stored in the PostgreSQL database</li>
          <li>Sign in is required to access your forms</li>
        </ol>
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
  );
}