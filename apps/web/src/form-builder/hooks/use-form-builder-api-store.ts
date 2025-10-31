import { create } from "zustand";
import { debounce } from "lodash";
import { apiClient } from "@/lib/api-client";
import type {
  FormElement,
  DropElement,
  EditElement,
  ReorderElements,
  AppendElement,
  FormElementOrList,
  SetTemplate,
  FormStep,
  FormElementList,
} from "@/form-builder/form-types";
import { defaultFormElements } from "@/form-builder/constant/default-form-element";
import { templates } from "@/form-builder/constant/templates";
import {
  dropAtIndex,
  flattenFormSteps,
  insertAtIndex,
  transformToStepFormList,
} from "@/form-builder/lib/form-elements-helpers";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

type MSForm = {
  formElements: FormStep[];
  isMS: true;
};

type SingleForm = {
  formElements: FormElementList;
  isMS: false;
};

type FormBuilderState = {
  isMS: boolean;
  meta: {
    name: string;
    id: string;
    publicId?: string;
    status?: 'draft' | 'published' | 'archived';
  };
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastSaved: Date | null;

  // API Methods
  loadForm: (formId: string) => Promise<void>;
  saveForm: () => Promise<void>;
  publishForm: () => Promise<void>;
  duplicateForm: () => Promise<void>;

  // Local Methods
  appendElement: AppendElement;
  dropElement: DropElement;
  editElement: EditElement;
  reorder: ReorderElements;
  setTemplate: SetTemplate;
  resestFormElements: () => void;
  setIsMS: (isMS: boolean) => void;
  addFormStep: (position?: number) => void;
  removeFormStep: (stepIndex: number) => void;
  setFormElements: (
    f: FormElementOrList[] | FormStep[],
    options: { isMS: boolean; id: string; name: string }
  ) => void;
  reorderSteps: (newOrder: FormStep[]) => void;
} & (MSForm | SingleForm);

// Debounced save function
const debouncedSave = debounce(async (state: FormBuilderState, set: any) => {
  if (!state.meta.id) {
    // Create new form if no ID exists
    try {
      set({ saving: true, error: null });

      const formData = {
        title: state.meta.name || 'Untitled Form',
        description: '',
        schema: {
          isMS: state.isMS,
          formElements: state.formElements,
        },
        settings: {
          submitButtonText: 'Submit',
          redirectUrl: '',
          showProgressBar: true,
          allowSave: false,
          requireAuth: false,
        },
      };

      const response = await apiClient.createForm(formData);

      set({
        meta: {
          ...state.meta,
          id: response.id,
          publicId: response.publicId,
          status: response.status,
        },
        saving: false,
        lastSaved: new Date(),
      });

      toast.success('Form created and saved');
    } catch (error: any) {
      set({ saving: false, error: error.message });
      toast.error('Failed to save form');
    }
  } else {
    // Update existing form
    try {
      set({ saving: true, error: null });

      const formData = {
        title: state.meta.name || 'Untitled Form',
        schema: {
          isMS: state.isMS,
          formElements: state.formElements,
        },
      };

      await apiClient.updateForm(state.meta.id, formData);

      set({ saving: false, lastSaved: new Date() });
    } catch (error: any) {
      set({ saving: false, error: error.message });
      toast.error('Failed to save form');
    }
  }
}, 2000); // Auto-save after 2 seconds of inactivity

export const useFormBuilderApiStore = create<FormBuilderState>((set, get) => ({
  formElements: [],
  isMS: false,
  meta: {
    name: "",
    id: "",
  },
  loading: false,
  saving: false,
  error: null,
  lastSaved: null,

  // API Methods
  loadForm: async (formId: string) => {
    try {
      set({ loading: true, error: null });
      const form = await apiClient.getForm(formId);

      const schema = form.schema as any;
      set({
        formElements: schema.formElements || [],
        isMS: schema.isMS || false,
        meta: {
          name: form.title,
          id: form.id,
          publicId: form.publicId,
          status: form.status,
        },
        loading: false,
      });
    } catch (error: any) {
      set({ loading: false, error: error.message });
      toast.error('Failed to load form');
    }
  },

  saveForm: async () => {
    const state = get();
    await debouncedSave(state, set);
  },

  publishForm: async () => {
    const state = get();
    if (!state.meta.id) {
      toast.error('Please save the form first');
      return;
    }

    try {
      set({ saving: true, error: null });
      const response = await apiClient.publishForm(state.meta.id);

      set({
        meta: {
          ...state.meta,
          status: 'published',
        },
        saving: false,
      });

      toast.success(`Form published! Share link: ${window.location.origin}/f/${response.publicId}`);
    } catch (error: any) {
      set({ saving: false, error: error.message });
      toast.error('Failed to publish form');
    }
  },

  duplicateForm: async () => {
    const state = get();
    if (!state.meta.id) {
      toast.error('Please save the form first');
      return;
    }

    try {
      set({ loading: true, error: null });
      const response = await apiClient.duplicateForm(state.meta.id);

      set({
        meta: {
          name: response.title,
          id: response.id,
          publicId: response.publicId,
          status: response.status,
        },
        loading: false,
      });

      toast.success('Form duplicated successfully');
    } catch (error: any) {
      set({ loading: false, error: error.message });
      toast.error('Failed to duplicate form');
    }
  },

  // Local Methods (same as original but with auto-save)
  appendElement: (options) => {
    const { fieldIndex, fieldType } = options || { fieldIndex: null };
    set((state) => {
      const { isMS } = state;
      switch (isMS) {
        case true: {
          const stepIndex = options?.stepIndex as number;
          const clonedFormElements = [...state.formElements];

          const stepFields = clonedFormElements[stepIndex].stepFields;
          const id = uuid();
          const newFormElement = {
            id,
            ...defaultFormElements[fieldType],
            fieldType,
            name: `${fieldType.toLowerCase()}-${id.slice(0, 3)}`,
          } as FormElement;
          if (typeof fieldIndex == "number") {
            // Append to a nested array
            stepFields[fieldIndex] = [
              stepFields[fieldIndex] as FormElement,
              newFormElement,
            ];
          } else {
            stepFields.push(newFormElement);
          }
          state.formElements[stepIndex].stepFields = stepFields;
          return { formElements: clonedFormElements };
        }
        default:
          const id = uuid();
          const newFormElement = {
            id,
            ...defaultFormElements[fieldType],
            fieldType,
            name: `${fieldType.toLowerCase()}-${id.slice(0, 3)}`,
          } as FormElement;
          const clonedFormElements = [...state.formElements];
          if (typeof fieldIndex == "number") {
            // Append to a nested array
            clonedFormElements[fieldIndex] = [
              clonedFormElements[fieldIndex] as FormElement,
              newFormElement,
            ];
          } else {
            clonedFormElements.push(newFormElement);
          }
          return { formElements: clonedFormElements };
      }
    });
    // Trigger auto-save
    debouncedSave(get(), set);
  },

  dropElement: ({ position, fieldType }) => {
    const state = get();
    const { isMS, formElements } = state;
    const id = uuid();

    if (isMS) {
      const stepIndex = position?.stepIndex || 0;
      const fieldIndex = position?.fieldIndex;
      const clonedFormElements = [...formElements];
      const stepFields = clonedFormElements[stepIndex].stepFields;

      const newFormElement = {
        id,
        ...defaultFormElements[fieldType],
        fieldType,
        name: `${fieldType.toLowerCase()}-${id.slice(0, 3)}`,
      } as FormElement;

      if (typeof fieldIndex === "number") {
        const updatedStepFields = insertAtIndex(
          fieldIndex,
          newFormElement,
          stepFields
        );
        clonedFormElements[stepIndex].stepFields = updatedStepFields;
      } else {
        stepFields.push(newFormElement);
      }

      set({ formElements: clonedFormElements });
    } else {
      const newFormElement = {
        id,
        ...defaultFormElements[fieldType],
        fieldType,
        name: `${fieldType.toLowerCase()}-${id.slice(0, 3)}`,
      } as FormElement;

      const fieldIndex = position?.fieldIndex;
      if (typeof fieldIndex === "number") {
        const updatedFormElements = insertAtIndex(
          fieldIndex,
          newFormElement,
          formElements as FormElementList
        );
        set({ formElements: updatedFormElements });
      } else {
        set({ formElements: [...formElements, newFormElement] as FormElementList });
      }
    }

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  editElement: ({ position, editedFormElement }) => {
    set((state) => {
      const { isMS, formElements } = state;

      if (isMS) {
        const stepIndex = position?.stepIndex || 0;
        const fieldIndex = position?.fieldIndex;
        const clonedFormElements = [...formElements];
        const stepFields = clonedFormElements[stepIndex].stepFields;

        if (typeof fieldIndex === "number") {
          stepFields[fieldIndex] = editedFormElement;
        }

        return { formElements: clonedFormElements };
      } else {
        const fieldIndex = position?.fieldIndex;
        const clonedFormElements = [...formElements] as FormElementList;

        if (typeof fieldIndex === "number") {
          clonedFormElements[fieldIndex] = editedFormElement;
        }

        return { formElements: clonedFormElements };
      }
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  reorder: ({ position, reorderedFormElements }) => {
    set((state) => {
      const { isMS } = state;

      if (isMS) {
        const stepIndex = position?.stepIndex || 0;
        const clonedFormElements = [...state.formElements];
        clonedFormElements[stepIndex].stepFields = reorderedFormElements as FormElementList;
        return { formElements: clonedFormElements };
      } else {
        return { formElements: reorderedFormElements as FormElementList };
      }
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  setTemplate: ({ template }) => {
    const selectedTemplate = templates.find(t => t.name === template);
    if (!selectedTemplate) return;

    const { form, isMS } = selectedTemplate;
    set({
      formElements: form,
      isMS,
      meta: {
        name: template,
        id: uuid(),
      },
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  resestFormElements: () => {
    set({
      formElements: [],
      meta: {
        name: "",
        id: "",
      },
    });
  },

  setIsMS: (isMS: boolean) => {
    set((state) => {
      if (isMS) {
        const stepFields = flattenFormSteps(state.formElements as FormElementList);
        return {
          isMS: true,
          formElements: transformToStepFormList(stepFields),
        };
      } else {
        const flattenedFields = (state.formElements as FormStep[]).reduce(
          (acc, step) => [...acc, ...flattenFormSteps(step.stepFields)],
          [] as FormElementList
        );
        return {
          isMS: false,
          formElements: flattenedFields,
        };
      }
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  addFormStep: (position) => {
    set((state) => {
      if (!state.isMS) return state;

      const clonedFormElements = [...state.formElements];
      const newStep: FormStep = {
        stepName: `Step ${clonedFormElements.length + 1}`,
        stepFields: [],
      };

      if (typeof position === "number") {
        clonedFormElements.splice(position, 0, newStep);
      } else {
        clonedFormElements.push(newStep);
      }

      return { formElements: clonedFormElements };
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  removeFormStep: (stepIndex: number) => {
    set((state) => {
      if (!state.isMS) return state;

      const clonedFormElements = [...state.formElements];
      clonedFormElements.splice(stepIndex, 1);

      return { formElements: clonedFormElements };
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  setFormElements: (f, options) => {
    set({
      formElements: f as any,
      isMS: options.isMS,
      meta: {
        name: options.name,
        id: options.id,
      },
    });

    // Trigger auto-save
    debouncedSave(get(), set);
  },

  reorderSteps: (newOrder: FormStep[]) => {
    set({ formElements: newOrder });

    // Trigger auto-save
    debouncedSave(get(), set);
  },
}));