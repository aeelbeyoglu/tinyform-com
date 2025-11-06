/**
 * Form Migration Service
 * Handles migration of forms from localStorage to API after user authentication
 */

import { apiClient } from '@/lib/api-client';
import useFormBuilderStore from '@/form-builder/hooks/use-form-builder-store';
import { toast } from 'sonner';

export interface MigrationResult {
  success: boolean;
  formId?: string;
  publicId?: string;
  error?: string;
}

/**
 * Migrates the current form from localStorage to API
 * This is called after successful authentication when a guest user tries to publish
 */
export async function migrateCurrentFormToAPI(): Promise<MigrationResult> {
  try {
    // Get current form state from store
    const state = useFormBuilderStore.getState();
    const { formElements, isMS, meta } = state;

    // Check if we have a valid form to migrate
    if (!formElements || formElements.length === 0) {
      throw new Error('No form data to migrate');
    }

    // Prepare form data for API
    const formData = {
      title: meta.name || 'Untitled Form',
      description: '',
      schema: {
        isMS,
        formElements
      },
      settings: {
        // Only include valid properties that the API expects
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        // Don't include redirectUrl if it's empty
      },
      status: 'draft' as const, // Start as draft, will be published separately
    };

    // Create form via API
    console.log('Creating form in API with data:', JSON.stringify(formData, null, 2));
    const response = await apiClient.createForm(formData);

    if (!response.form || !response.form.id) {
      throw new Error('Invalid response from API');
    }

    // Update the store with the new API form ID
    useFormBuilderStore.getState().setFormElements(formElements, {
      isMS,
      id: response.form.id,
      name: response.form.title || meta.name,
    });

    // Remove the old localStorage form if it exists
    // This includes template forms and regular local forms
    if (meta.id) {
      removeLocalStorageForm(meta.id);
    }

    toast.success('Form successfully saved to your account!');

    return {
      success: true,
      formId: response.form.id,
      publicId: response.form.publicId,
    };
  } catch (error: any) {
    console.error('Failed to migrate form to API:', error);

    return {
      success: false,
      error: error.message || 'Failed to migrate form',
    };
  }
}

/**
 * Publishes a form immediately after migration
 */
export async function publishMigratedForm(formId: string): Promise<MigrationResult> {
  try {
    const response = await apiClient.publishForm(formId);

    toast.success('Form published successfully!', {
      description: `Your form is now live at: /f/${response.form.publicId}`,
      duration: 5000,
    });

    return {
      success: true,
      formId: response.form.id,
      publicId: response.form.publicId,
    };
  } catch (error: any) {
    console.error('Failed to publish migrated form:', error);

    return {
      success: false,
      error: error.message || 'Failed to publish form',
    };
  }
}

/**
 * Complete migration flow: create in API and then publish
 */
export async function migrateAndPublishForm(): Promise<MigrationResult> {
  // Step 1: Migrate to API
  const migrationResult = await migrateCurrentFormToAPI();

  if (!migrationResult.success || !migrationResult.formId) {
    return migrationResult;
  }

  // Step 2: Publish the migrated form
  const publishResult = await publishMigratedForm(migrationResult.formId);

  return publishResult;
}

/**
 * Checks if a string is a valid UUID (to distinguish API forms from local forms)
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Removes a form from localStorage
 */
function removeLocalStorageForm(formId: string): void {
  try {
    // Try the new storage key first
    const newStorageKey = 'formcn-forms-list';
    const newStored = localStorage.getItem(newStorageKey);

    if (newStored) {
      const data = JSON.parse(newStored);
      if (data.state && data.state.forms) {
        data.state.forms = data.state.forms.filter((f: any) => f.id !== formId);
        localStorage.setItem(newStorageKey, JSON.stringify(data));
        console.log(`Removed local form ${formId} from localStorage (new key)`);
      }
    }

    // Also try the old storage key
    const oldStorageKey = 'local-forms-store';
    const oldStored = localStorage.getItem(oldStorageKey);

    if (oldStored) {
      const data = JSON.parse(oldStored);
      if (data.state && data.state.forms) {
        data.state.forms = data.state.forms.filter((f: any) => f.id !== formId);
        localStorage.setItem(oldStorageKey, JSON.stringify(data));
        console.log(`Removed local form ${formId} from localStorage (old key)`);
      }
    }
  } catch (error) {
    console.error('Error removing form from localStorage:', error);
  }
}

/**
 * Saves the current form state temporarily before authentication
 * This ensures the form is not lost during the auth flow
 */
export function saveFormStateForAuth(): string {
  const state = useFormBuilderStore.getState();
  const tempId = `temp-form-${Date.now()}`;

  const formData = {
    formElements: state.formElements,
    isMS: state.isMS,
    meta: state.meta,
    timestamp: Date.now(),
  };

  sessionStorage.setItem(tempId, JSON.stringify(formData));
  return tempId;
}

/**
 * Restores form state after authentication
 */
export function restoreFormStateAfterAuth(tempId: string): boolean {
  try {
    const stored = sessionStorage.getItem(tempId);
    if (!stored) return false;

    const formData = JSON.parse(stored);

    // Restore the form state
    useFormBuilderStore.getState().setFormElements(
      formData.formElements,
      {
        isMS: formData.isMS,
        id: formData.meta.id,
        name: formData.meta.name,
      }
    );

    // Clean up temp storage
    sessionStorage.removeItem(tempId);
    return true;
  } catch (error) {
    console.error('Error restoring form state:', error);
    return false;
  }
}