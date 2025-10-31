"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { genFormZodSchema } from "@/form-builder/lib/generate-zod-schema";
import { flattenFormSteps } from "@/form-builder/lib/form-elements-helpers";
import type { FormElement, FormStep } from "@/form-builder/form-types";
import { FormPreview } from "@/form-builder/components/preview/form-preview";

interface PublicFormRendererProps {
  formData: {
    title: string;
    description?: string;
    schema: any;
    settings: any;
  };
  onSubmit: (data: any) => Promise<void>;
}

export function PublicFormRenderer({ formData, onSubmit }: PublicFormRendererProps) {
  // Flatten form elements and prepare schema
  const flattenFormElements = formData?.schema ?
    (formData.schema.isMS
      ? flattenFormSteps(formData.schema.formElements as FormStep[]).flat()
      : (formData.schema.formElements?.flat() as FormElement[] || [])
    ) : [];

  const filteredFormFields = flattenFormElements.filter(
    (o: any) => !("static" in o)
  );

  // Prepare default values
  const defaultValues = filteredFormFields.reduce((acc: any, element: any) => {
    acc[element.name] = element?.defaultValue !== undefined ? element.defaultValue : "";
    return acc;
  }, {});

  // Setup form with react-hook-form
  const form = useForm({
    resolver: filteredFormFields.length > 0 ?
      zodResolver(genFormZodSchema(filteredFormFields) as any) :
      undefined,
    mode: "onBlur",
    defaultValues,
  });

  return (
    <FormPreview
      form={form}
      formElements={formData.schema?.formElements || []}
      isMS={formData.schema?.isMS || false}
      onSubmit={onSubmit}
    />
  );
}