import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'iconsax-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const companySchema = z.object({
  company_name: z.string().min(1, 'onboarding.form.errors.company_name'),
  company_address: z.string().min(1, 'onboarding.form.errors.company_address'),
  tin: z.string().min(1, 'onboarding.form.errors.tin'),
  tax_office: z.string().min(1, 'onboarding.form.errors.tax_office'),
  contact_email: z.string().email('onboarding.form.errors.contact_email'),
  phone_number: z.string().min(1, 'onboarding.form.errors.phone_number'),
  number_of_employees: z.string().optional(),
  billing_address: z.string().min(1, 'onboarding.form.errors.billing_address'),
  preferred_payment_method: z.enum(['credit_card', 'bank_transfer']),
  preferred_language: z.enum(['el', 'en']),
  tos_accepted: z
    .boolean()
    .refine((val) => val === true, 'onboarding.form.errors.tos_accepted'),
});

export type CompanyFormData = z.infer<typeof companySchema>;

export function CompanyForm({
  formData,
  onSubmit,
  showNext,
}: {
  formData: CompanyFormData;
  onSubmit: (data: CompanyFormData) => void;
  showNext: boolean;
}) {
  const t = useTranslations('onboarding');
  const form = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: formData.company_name || '',
      company_address: formData.company_address || '',
      tin: formData.tin || '',
      tax_office: formData.tax_office || '',
      contact_email: formData.contact_email || '',
      phone_number: formData.phone_number || '',
      number_of_employees: formData.number_of_employees || '',
      billing_address: formData.billing_address || '',
      preferred_payment_method:
        formData.preferred_payment_method || 'credit_card',
      preferred_language: formData.preferred_language || 'english',
      tos_accepted: formData.tos_accepted || false,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='company_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.company_name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='company_address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.company_address')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='contact_email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.contact_email')}</FormLabel>
                <FormControl>
                  <Input type='email' {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='phone_number'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.phone_number')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='tin'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.tin')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='tax_office'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.tax_office')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='number_of_employees'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.number_of_employees')}</FormLabel>
                <FormControl>
                  <Input type='number' {...field} />
                </FormControl>
                <FormMessage useTranslation />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='billing_address'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.billing_address')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage useTranslation />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='preferred_payment_method'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.preferred_payment_method')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.select_method')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='credit_card'>
                    {t('form.payment_methods.credit_card')}
                  </SelectItem>
                  <SelectItem value='bank_transfer'>
                    {t('form.payment_methods.bank_transfer')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage useTranslation />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='preferred_language'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.preferred_language')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.select_language')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='el'>{t('form.languages.el')}</SelectItem>
                  <SelectItem value='en'>{t('form.languages.en')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage useTranslation />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='tos_accepted'
          render={({ field }) => (
            <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel>{t('form.terms')}</FormLabel>
                <FormMessage useTranslation />
              </div>
            </FormItem>
          )}
        />

        {showNext && (
          <div className='flex justify-end'>
            <Button type='submit'>
              {t('form.next')} <ArrowRight className='w-4 h-4 ml-2' />
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
