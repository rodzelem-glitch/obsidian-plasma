
export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number';
    required: boolean;
    options?: string[];
}

export interface CustomForm {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    fields: FormField[];
    createdAt: string;
    createdBy: string;
    active: boolean;
}
