"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import useFormBuilderStore from "@/form-builder/hooks/use-form-builder-store";
import useLocalForms from "@/form-builder/hooks/use-local-forms";
import { toast } from "sonner";
import { FormBuilder } from "./form-builder";
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
  const { user } = useAuth();
  const formId = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [isApiForm, setIsApiForm] = useState(false);
  const formDetailsRef = useRef<any>(null);

  const setFormElements = useFormBuilderStore((s) => s.setFormElements);
  const formElements = useFormBuilderStore((s) => s.formElements);
  const getFormById = useLocalForms((s) => s.getFormById);

  // Auto-save for API forms (debounced)
  const saveToApi = debounce(async () => {
    if (!isApiForm || !formId || !user || !formDetailsRef.current) return;

    try {
      const formData = {
        title: formDetailsRef.current.title,
        description: formDetailsRef.current.description,
        schema: {
          isMS: useFormBuilderStore.getState().isMS,
          formElements: useFormBuilderStore.getState().formElements
        },
        settings: formDetailsRef.current.settings,
        status: formDetailsRef.current.status // Maintain the current status
      };

      const response = await apiClient.updateForm(formId, formData);

      // Update local form details with response
      formDetailsRef.current = response.form;

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

  // Load form on mount
  useEffect(() => {
    async function loadForm() {
      if (!formId) {
        setLoading(false);
        return;
      }

      // Check if it's a UUID (API form)
      if (isUUID(formId) && user) {
        setIsApiForm(true);
        try {
          const response = await apiClient.getForm(formId);
          const schema = response.form.schema as any;

          // Store the complete form details
          formDetailsRef.current = response.form;

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
        // Load from localStorage for templates or local forms
        const localForm = getFormById(formId);
        if (localForm) {
          setFormElements(localForm.formElements, {
            isMS: localForm.isMS,
            id: localForm.id,
            name: localForm.name
          });
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
  }, [formElements, isApiForm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {isApiForm && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-2 mb-4 mx-2">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✅ This form is saved to the database and auto-saves every 2 seconds
          </p>
        </div>
      )}
      <FormBuilder />
    </>
  );
}