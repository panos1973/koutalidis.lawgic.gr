"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { FileUpload } from "@/components/ui/file-upload";

// Define the form schema with validation
const getFormSchema = (t: any) =>
  z.object({
    name: z.string().min(3, {
      message: t("validation.nameRequired"),
    }),
    description: z.string().optional(),
    taxId: z
      .string()
      .min(1, { message: t("validation.taxIdRequired") })
      .optional(), // Optional for now, adjust as needed
    vatNumber: z.string().optional(),
    registrationNumber: z.string().optional(),
    address: z.string().min(1, { message: t("validation.addressRequired") }),
    city: z.string().min(1, { message: t("validation.cityRequired") }),
    state: z.string().optional(),
    postalCode: z
      .string()
      .min(1, { message: t("validation.postalCodeRequired") }),
    country: z.string().min(1, { message: t("validation.countryRequired") }),
    email: z.string().email({ message: t("validation.emailInvalid") }),
    phone: z.string().min(1, { message: t("validation.phoneRequired") }),
    planId: z.string().uuid({
      message: t("validation.planRequired"),
    }),

    paymentProof: z
      .instanceof(File)
      .refine((file) => file.size > 0, {
        message: t("validation.paymentProofRequired"),
      })
      .refine((file) => file.size <= 1024 * 1024, {
        message: t("validation.fileSizeLimit"),
      })
      .refine(
        (file) => ["image/jpeg", "image/png", "image/jpg"].includes(file.type),
        {
          message: t("validation.fileTypeLimit"),
        }
      ),
  });

type FormValues = z.infer<ReturnType<typeof getFormSchema>>;

// Import server action for creating organization
import { createOrganization } from "@/app/[locale]/actions/organizations";

interface OrganizationCreateFormProps {
  plans: any[];
  locale: string;
  selectedPlanId?: string;
  interval: string;
}

export default function OrganizationCreateForm({
  plans,
  locale,
  selectedPlanId,
  interval,
}: OrganizationCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const t = useTranslations("organization");

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(getFormSchema(t)),
    defaultValues: {
      name: "",
      description: "",
      taxId: "",
      vatNumber: "",
      registrationNumber: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      email: "",
      phone: "",
      planId: selectedPlanId || (plans.length > 0 ? plans[0].id : ""),
      // paymentProof: undefined, // Handled by file input state
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      // Create FormData object for file upload
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description || "");
      formData.append("taxId", data.taxId || "");
      formData.append("vatNumber", data.vatNumber || "");
      formData.append("registrationNumber", data.registrationNumber || "");
      formData.append("address", data.address);
      formData.append("city", data.city);
      formData.append("state", data.state || "");
      formData.append("postalCode", data.postalCode);
      formData.append("country", data.country);
      formData.append("email", data.email);
      formData.append("phone", data.phone);
      formData.append("planId", data.planId);
      formData.append("interval", interval);
      formData.append("paymentProof", data.paymentProof);

      // Call server action
      const result = await createOrganization(formData);

      if (result.success) {
        toast.success(t("messages.submissionSuccess"));

        // Redirect to waiting page
        router.push(`/${locale}/organization/waiting`);
      } else {
        throw new Error(result.error || t("messages.createFailed"));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(t("messages.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file selection
  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);

    if (file) {
      form.setValue("paymentProof", file, {
        shouldValidate: true,
      });
    } else {
      form.setValue("paymentProof", undefined as any, {
        shouldValidate: true,
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("sections.basicInfo")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Organization Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.name")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.name")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tax ID */}
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.taxId")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.taxId")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.taxId")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* VAT Number */}
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.vatNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.vatNumber")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.vatNumber")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Registration Number */}
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.registrationNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.registrationNumber")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.registrationNumber")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("placeholders.description")}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("descriptions.description")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {t("sections.contactInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("placeholders.email")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.email")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.phone")}</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder={t("placeholders.phone")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.phone")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {t("sections.addressInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.address")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.address")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.city")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.city")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.state")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.state")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.postalCode")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.postalCode")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.country")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.country")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Registration Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {t("sections.registrationInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.taxId")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.taxId")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.taxId")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.vatNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.vatNumber")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.vatNumber")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.registrationNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("placeholders.registrationNumber")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("descriptions.registrationNumber")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Plan and Payment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {t("sections.planPayment")}
              </h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.plan")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.plan")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - {plan.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("descriptions.plan")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentProof"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.paymentProof")}</FormLabel>
                      <FormControl>
                        <FileUpload
                          onFileSelect={handleFileChange}
                          value={selectedFile}
                          maxSize={1024 * 1024} // 1MB
                          accept={{
                            "image/jpeg": [],
                            "image/png": [],
                            "image/jpg": [],
                          }}
                          label={t("fields.paymentProof")}
                          helpText={t("descriptions.paymentProof")}
                          error={
                            form.formState.errors.paymentProof
                              ?.message as string
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  {t("buttons.creating")}
                </>
              ) : (
                t("buttons.create")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
