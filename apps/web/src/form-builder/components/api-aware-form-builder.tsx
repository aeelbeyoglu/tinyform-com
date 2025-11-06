"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import useFormBuilderStore from "@/form-builder/hooks/use-form-builder-store";
import useLocalForms from "@/form-builder/hooks/use-local-forms";
import { toast } from "sonner";
import { FormBuilder } from "./form-builder";
import { FormBuilderHeader } from "./form-builder-header";
import { Loader2 } from "lucide-react";
import { AuthRequiredDialog } from "@/components/auth-required-dialog";
import { migrateAndPublishForm } from "@/lib/form-migration";

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Check if ID is a UUID (API form) or a template/local ID
function isUUID(str: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function ApiAwareFormBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const formId = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [isApiForm, setIsApiForm] = useState(false);
  const formDetailsRef = useRef<any>(null);
  const [formTitle, setFormTitle] = useState("Untitled Form");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  const setFormElements = useFormBuilderStore((s) => s.setFormElements);
  const formElements = useFormBuilderStore((s) => s.formElements);
  const getFormById = useLocalForms((s) => s.getFormById);

  // Auto-save for API forms (debounced)
  const saveToApi = debounce(async () => {
    // Don't auto-save during migration or if not an API form
    if (!isApiForm || !formId || !user || isMigrating) return;

    // Don't try to save template forms or local forms
    if (formId.startsWith('template-') || !isUUID(formId)) return;

    try {
      const formData = {
        title: formTitle,
        description: formDescription,
        schema: {
          isMS: useFormBuilderStore.getState().isMS,
          formElements: useFormBuilderStore.getState().formElements
        },
        settings: formDetailsRef.current?.settings || {},
        status: formStatus // Maintain the current status
      };

      const response = await apiClient.updateForm(formId, formData);

      // Update local form details with response
      formDetailsRef.current = response.form;
      setFormStatus(response.form.status);

      // Show different message if form is published
      if (response.form.status === 'published') {
        toast.success("Form saved and published version updated");
      } else {
        console.log("Form auto-saved to API");
      }
    } catch (error: any) {
      // Don't show errors for 404s during migration
      if (error.status === 404 && isMigrating) {
        console.log("Form not found during migration, skipping auto-save");
        return;
      }
      console.error("Failed to auto-save:", error);
    }
  }, 2000);

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setFormTitle(newTitle);
    if (formDetailsRef.current) {
      formDetailsRef.current.title = newTitle;
    }
    if (isApiForm) {
      saveToApi();
    }
  };

  // Handle description change
  const handleDescriptionChange = (newDescription: string) => {
    setFormDescription(newDescription);
    if (formDetailsRef.current) {
      formDetailsRef.current.description = newDescription;
    }
    if (isApiForm) {
      saveToApi();
    }
  };

  // Handle publish
  const handlePublish = async () => {
    // If user is not authenticated, show auth dialog
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    // If it's not an API form, we need to migrate it first
    if (!isApiForm) {
      try {
        const result = await migrateAndPublishForm();
        if (result.success && result.formId) {
          // Update local state to reflect the new API form
          setIsApiForm(true);
          formDetailsRef.current = {
            id: result.formId,
            publicId: result.publicId,
            status: 'published'
          };
          setFormStatus('published');

          // Navigate to the new form URL
          router.push(`/form-builder?id=${result.formId}`);
        } else {
          toast.error(result.error || "Failed to publish form");
        }
      } catch (error: any) {
        console.error("Failed to migrate and publish form:", error);
        toast.error(error.message || "Failed to publish form");
      }
      return;
    }

    // Regular publish for existing API forms
    try {
      const response = await apiClient.publishForm(formId);
      setFormStatus('published');
      formDetailsRef.current = response.form;
      toast.success("Form published successfully!");

      if (response.publicUrl) {
        toast.success(`Public URL: ${response.publicUrl}`, {
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error("Failed to publish form:", error);
      toast.error(error.message || "Failed to publish form");
    }
  };

  // Handle successful authentication from dialog
  const handleAuthSuccess = async () => {
    console.log("Auth success callback triggered");

    // Set migration flag to prevent auto-save errors
    setIsMigrating(true);

    // The user has successfully authenticated, now migrate and publish the form
    try {
      // Log current form state before migration
      const currentState = useFormBuilderStore.getState();
      console.log("Current form state before migration:", {
        formElements: currentState.formElements,
        isMS: currentState.isMS,
        meta: currentState.meta
      });

      const result = await migrateAndPublishForm();

      if (result.success && result.formId) {
        // Update local state to reflect the new API form
        setIsApiForm(true);
        setIsGuest(false);
        formDetailsRef.current = {
          id: result.formId,
          publicId: result.publicId,
          status: 'published'
        };
        setFormStatus('published');

        // Clear the migration flag before navigating
        setIsMigrating(false);

        // Navigate to the new form URL
        router.push(`/form-builder?id=${result.formId}`);

        toast.success(`Form published! View it at: /f/${result.publicId}`, {
          duration: 5000,
        });
      } else {
        console.error("Migration failed:", result.error);
        toast.error(result.error || "Failed to publish form after sign in");
        setIsMigrating(false);
      }
    } catch (error: any) {
      console.error("Failed to migrate and publish after auth:", error);
      toast.error(error.message || "Failed to publish form");
      setIsMigrating(false);
    }
  };

  // Track guest status
  useEffect(() => {
    setIsGuest(!user);
  }, [user]);

  // Load form on mount
  useEffect(() => {
    async function loadForm() {
      // If no form ID, this is a new form - guests can create new forms
      if (!formId) {
        setLoading(false);
        setIsApiForm(false); // New forms start as local/guest forms
        return;
      }

      // First check localStorage - this takes priority
      const localForm = getFormById(formId);

      if (localForm) {
        // Form exists in localStorage, load it locally
        setIsApiForm(false);
        setFormTitle(localForm.name || "Untitled Form");
        setFormDescription("");
        setFormElements(localForm.formElements, {
          isMS: localForm.isMS,
          id: localForm.id,
          name: localForm.name
        });
        setLoading(false);
        return;
      }

      // Not in localStorage, check if it's a UUID (API form)
      if (isUUID(formId)) {
        // Only try to load from API if user is authenticated
        if (user) {
          setIsApiForm(true);
          try {
            const response = await apiClient.getForm(formId);
            const schema = response.form.schema as any;

            // Store the complete form details
            formDetailsRef.current = response.form;

            // Update local state
            setFormTitle(response.form.title || "Untitled Form");
            setFormDescription(response.form.description || "");
            setFormStatus(response.form.status || 'draft');

            setFormElements(schema.formElements || [], {
              isMS: schema.isMS || false,
              id: formId,
              name: response.form.title || "Untitled Form"
            });

            toast.success("Form loaded from database");
          } catch (error) {
            console.error("Failed to load form from API:", error);
            toast.error("Failed to load form. Please check your connection.");
          }
        } else {
          // Guest user trying to access an API form - redirect to home
          toast.error("Please sign in to access this form");
          router.push('/');
        }
      }

      setLoading(false);
    }

    loadForm();
  }, [formId, user]);

  // Watch for changes and auto-save to API
  useEffect(() => {
    // Only auto-save if it's an API form and not during migration
    if (isApiForm && formElements && !isMigrating) {
      saveToApi();
    }
  }, [formElements, isApiForm, formTitle, formDescription, isMigrating]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <FormBuilderHeader
          formId={formDetailsRef.current?.publicId}
          title={formTitle}
          description={formDescription}
          status={formStatus}
          isApiForm={isApiForm}
          isGuest={isGuest}
          onTitleChange={handleTitleChange}
          onDescriptionChange={handleDescriptionChange}
          onPublish={handlePublish}
        />
        <FormBuilder />
      </div>

      <AuthRequiredDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onSuccess={handleAuthSuccess}
        title="Sign in to publish your form"
        description="Create a free account to publish and share your form. Your form will be saved automatically."
      />
    </>
  );
}