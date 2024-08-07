'use server';

import {z} from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
){
    try {
        await signIn('credentials', formData);
    } catch(error) {
        if (error instanceof AuthError){
            switch (error.type){
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }

}

const FormSchema = z.object(
    {
        id: z.string(),
        customerId: z.string({
            invalid_type_error: 'Please select a customer'
        }),
        amount: z.coerce.number().gt(0, {message: 'Please enter an amount greater than 0.'}),
        status: z.enum(['pending', 'paid'], {
            invalid_type_error: 'Please select an invoice status'
        }),
        date:z.string(),
    }
);

const CreateInvoice = FormSchema.omit({id: true, date: true})

export type State = {
    errors?:{
        customerId?: string[],
        amount?: string[],
        status?: string[],
    };

    message?: string | null,
};

export async function createInvoice(preState: State, formData: FormData){
    const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    };

    console.log(rawFormData);
    console.log(typeof(rawFormData.amount));

    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    console.log(validatedFields);

    if (!validatedFields.success)
    {
        return{
            error: validatedFields.error.flatten().fieldErrors,
            message: 'Missing fields, failed to create invoice',
        };

    }
    const amountInCents = validatedFields.data.amount * 100;
    const date = new Date().toISOString().split('T')[0];
    const customerId = validatedFields.data.customerId;
    const status = validatedFields.data.status;


    try{
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch(error) {
        console.log('Create invoice error.')
        return {message: 'Database error. Failed to create an invoice.'};
    }

    revalidatePath('/dashboard/invoces');
    redirect('/dashboard/invoices')
}


const UpdateInvoice = FormSchema.omit({id: true, date:true});

export async function updateInvoice(id: string, formData:FormData){

    const {customerId, amount, status} = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    try{
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch(error){
        return {message: "Database error. Failed to update the invoice."};
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string){
    console.log("deleting invoice of id " + id);
    
    throw new Error("Failed!")

    try{
        await sql`
        DELETE FROM invoices WHERE id=${id}
    `;
    } catch(error) {
        return {message: "Database Error. Failed to delete the invoice."}
    }
    revalidatePath('/dashboard/invoices');
}