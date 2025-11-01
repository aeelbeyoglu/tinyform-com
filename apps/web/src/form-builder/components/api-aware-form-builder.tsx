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

  const setFormElements = useFormBuilderStore((s) => s.setFormElements);
  const formElements = useFormBuilderStore((s) => s.formElements);
  const getFormById = useLocalForms((s) => s.getFormById);

  // Auto-save for API forms (debounced)
  const saveToApi = debounce(async () => {
    if (!isApiForm || !formId || !user) return;

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
    } catch (error) {
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
    if (!isApiForm || !formId) {
      toast.error("Can only publish API forms");
      return;
    }

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

  // Load form on mount
  useEffect(() => {
    async function loadForm() {
      if (!formId) {
        setLoading(false);
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

      // Not in localStorage, check if it's a UUID and user is authenticated
      if (isUUID(formId) && user) {
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
      }

      setLoading(false);
    }

    loadForm();
  }, [formId, user]);

  // Watch for changes and auto-save to API
  useEffect(() => {
    if (isApiForm && formElements) {
      saveToApi();
    }
  }, [formElements, isApiForm, formTitle, formDescription]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FormBuilderHeader
        formId={formDetailsRef.current?.publicId}
        title={formTitle}
        description={formDescription}
        status={formStatus}
        isApiForm={isApiForm}
        onTitleChange={handleTitleChange}
        onDescriptionChange={handleDescriptionChange}
        onPublish={handlePublish}
      />
      <FormBuilder />
    </div>
  );
}