"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CloseCircle } from "iconsax-react";
import { useLocale, useTranslations } from "use-intl";

interface Prompt {
  title: string;
  prompt: string;
}

interface PromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

const PromptsModal: React.FC<PromptsModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const t = useTranslations("contract.chat");
  const locale = useLocale();

  const englishPrompts: Prompt[] = [
    {
      title: "Contract Draft Reproduction",
      prompt:
        "Generate a legally sound duplicate of the uploaded agreement, preserving all clauses, terms, and formatting.",
    },
    {
      title: "Email Draft: Contract Summary",
      prompt:
        "Draft a professional email summarizing the main terms and obligations of this contract for a client.",
    },
    {
      title: "Legal Risk Assessment",
      prompt:
        "Analyze the contract and draft a report identifying potential legal disputes, ambiguities, or high-risk clauses.",
    },
    {
      title: "Agreement Comparison Report",
      prompt:
        "Compare the two uploaded contracts and present differences in terms, obligations, and durations in a structured table.",
    },
    {
      title: "Clause Extraction",
      prompt:
        "Extract and categorize all clauses from this agreement under topics such as termination, liability, jurisdiction, etc.",
    },
    {
      title: "Contract Terms Retrieval",
      prompt:
        "Identify and list the core terms and conditions of this agreement in plain language.",
    },
    {
      title: "Key Statements Summary",
      prompt:
        "Summarize the most impactful and enforceable statements or declarations within the agreement.",
    },
    {
      title: "Stakeholder Mapping",
      prompt:
        "Identify all stakeholders mentioned in the contract and organize them in a table with their roles and obligations.",
    },
    {
      title: "Contract Timeline Overview",
      prompt:
        "Generate a chronological timeline of key dates and deliverables from this agreement.",
    },
    {
      title: "Breach Identification Report",
      prompt:
        "Evaluate the agreement and generate a list of clauses that may be subject to breach or non-compliance.",
    },
  ];

  const greekPrompts: Prompt[] = [
    {
      title: "Αναπαραγωγή Συμβολαίου",
      prompt:
        "Δημιούργησε ένα νομικά έγκυρο αντίγραφο της ανεβασμένης σύμβασης, διατηρώντας όλες τις ρήτρες, όρους και τη μορφοποίηση.",
    },
    {
      title: "Πρόχειρο Email: Περίληψη Συμβολαίου",
      prompt:
        "Συντάξτε ένα επαγγελματικό email που συνοψίζει τους βασικούς όρους και υποχρεώσεις της σύμβασης για έναν πελάτη.",
    },
    {
      title: "Αξιολόγηση Νομικών Κινδύνων",
      prompt:
        "Αναλύστε τη σύμβαση και δημιουργήστε αναφορά που εντοπίζει πιθανούς νομικούς κινδύνους ή ασαφείς ρήτρες.",
    },
    {
      title: "Σύγκριση Συμβάσεων",
      prompt:
        "Συγκρίνετε τις δύο ανεβασμένες συμβάσεις και παρουσιάστε τις διαφορές σε όρους, υποχρεώσεις και χρονικά όρια σε πίνακα.",
    },
    {
      title: "Εξαγωγή Ρητρών",
      prompt:
        "Εξαγάγετε και κατηγοριοποιήστε όλες τις ρήτρες της σύμβασης με βάση θεματικές ενότητες όπως καταγγελία, ευθύνη, δικαιοδοσία κ.ά.",
    },
    {
      title: "Ανάκτηση Όρων Σύμβασης",
      prompt:
        "Εντοπίστε και απαριθμήστε τους βασικούς όρους και προϋποθέσεις της σύμβασης σε απλή γλώσσα.",
    },
    {
      title: "Σύνοψη Σημαντικών Δηλώσεων",
      prompt:
        "Συνοψίστε τις πιο κρίσιμες και εκτελέσιμες δηλώσεις που περιέχονται στη σύμβαση.",
    },
    {
      title: "Χαρτογράφηση Ενδιαφερομένων",
      prompt:
        "Εντοπίστε όλα τα εμπλεκόμενα μέρη στη σύμβαση και οργανώστε τα σε πίνακα με τους ρόλους και τις υποχρεώσεις τους.",
    },
    {
      title: "Χρονολόγιο Συμβολαίου",
      prompt:
        "Δημιουργήστε ένα χρονολόγιο με τις βασικές ημερομηνίες και τις παραδοτέες ενέργειες της σύμβασης.",
    },
    {
      title: "Αναφορά Παραβιάσεων",
      prompt:
        "Αξιολογήστε τη σύμβαση και εντοπίστε ρήτρες που ενδέχεται να παραβιαστούν ή να μην τηρηθούν.",
    },
  ];

  const prompts = locale === "el" ? greekPrompts : englishPrompts;

  const handlePromptSelect = (prompt: string) => {
    onSelectPrompt(prompt);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t("prompts")}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {prompts.map((prompt, index) => (
            <div
              key={index}
              className="p-4 border rounded-xl hover:bg-gray-50 hover:cursor-pointer transition-colors"
              onClick={() => handlePromptSelect(prompt.prompt)}
            >
              <h6 className="font-medium mb-2 text-sm">{prompt.title}</h6>
              <p className="text-zinc-400 text-sm">{prompt.prompt}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromptsModal;
