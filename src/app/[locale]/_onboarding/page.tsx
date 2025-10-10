'use client';

import {
  CompanyForm,
  CompanyFormData,
} from '@/components/onboarding/company_form';
import {
  LawyerForm,
  LawyerFormData,
} from '@/components/onboarding/lawyer_form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@clerk/nextjs';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ProfileFormData = LawyerFormData & CompanyFormData;

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const locale = useLocale() || 'el';

  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [userType, setUserType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    contact_email: '',
    phone_number: '',
    bar_association: '',
    registration_number: '',
    tin: '',
    tax_office: '',
    billing_address: '',
    preferred_payment_method: 'credit_card',
    preferred_language: 'en',
    tos_accepted: false,
    company_address: '',
    company_name: '',
    additional_notes: '',
    number_of_employees: '',
  });

  const handleUserTypeSubmit = async () => {
    setIsLoading(true);
    try {
      // Update Clerk user metadata
      await user?.update({
        unsafeMetadata: {
          userType,
          defaultLanguage: formData.preferred_language,
        },
      });

      // Update user profile data
      await fetch(`/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType,
          profileData: formData,
        }),
      });

      router.push(`/${locale}/`);
    } catch (error) {
      console.error('Error updating user type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (data: LawyerFormData | CompanyFormData) => {
    setFormData(data as ProfileFormData);
    localStorage.setItem('formData', JSON.stringify(data));
    setIsFormSubmitted(true); // Set the form as submitted
  };

  const handleBack = () => {
    setIsFormSubmitted(false);
    setFormData(JSON.parse(localStorage.getItem('formData')!));
  };

  const formatReviewValue = (key: string, value: any) => {
    switch (key) {
      case 'preferred_payment_method':
        // Capitalize each word and replace underscores with spaces
        return value
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      case 'preferred_language':
        // Capitalize the first letter of the language
        return value === 'el' ? 'Greek' : 'English';
      case 'tos_accepted':
        return value === true ? 'Accepted' : 'Not Accepted';
      default:
        return value;
    }
  };

  return (
    <div className='max-w-2xl mx-auto p-6'>
      {isFormSubmitted ? (
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle className='text-xl font-bold mb-4'>
              Review Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className='space-y-2'>
              {Object.entries(formData).map(
                ([key, value]) =>
                  value && (
                    <div key={key} className='grid grid-cols-3 gap-4'>
                      <dt className='font-medium capitalize col-span-1'>
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className='col-span-2'>
                        {Array.isArray(value)
                          ? value.join(', ')
                          : formatReviewValue(key, value).toString()}
                      </dd>
                    </div>
                  )
              )}
            </dl>

            <div className='flex justify-between items-center mt-4'>
              {/* Back Button */}
              <Button variant='outline' onClick={handleBack} className='mt-2' disabled={isLoading}>
                Back
              </Button>
              {/* Complete Button */}
              <Button
                onClick={handleUserTypeSubmit}
                className='flex items-center justify-center gap-2 mt-2'
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <ReloadIcon className='animate-spin h-5 w-5' /> Complete
                  </>
                ) : (
                  'Complete'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-xl font-bold mb-4'>
              Complete Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* User Type Selection */}
            <div className='mb-6'>
              <label className='block mb-2'>Account Type</label>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className='w-full p-2 border rounded'
              >
                <option value=''>Select...</option>
                <option value='lawyer'>Lawyer</option>
                <option value='company'>Company</option>
              </select>
            </div>

            {/* Conditional Form Fields */}
            {userType === 'lawyer' && (
              <LawyerForm
                formData={formData}
                onSubmit={handleSubmit}
                showNext={!isFormSubmitted}
              />
            )}

            {userType === 'company' && (
              <CompanyForm
                formData={formData}
                onSubmit={handleSubmit}
                showNext={!isFormSubmitted}
              />
            )}

            {isFormSubmitted && (
              <div className='flex justify-end mt-4'>
                <Button
                  onClick={handleUserTypeSubmit}
                  className='flex items-center justify-center gap-2 mt-2'
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <ReloadIcon className='animate-spin h-5 w-5' /> Complete
                    </>
                  ) : (
                    'Complete'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
