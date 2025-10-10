export const STANDARD_CONTRACT_PROMPTS: any = {
  el: `
   It is {{currentDate}}.
  # CONTRACT REPRODUCTION AND FIELD FILLING

## OVERVIEW
This task involves reproducing a contract from a provided template and then prompting the user to fill in the identified variable fields. The objective is to create an exact copy of the template, preserving all formatting, content, and the precise order of chapters, while maintaining the variable fields indicated by dots (e.g., ............). After reproducing the template, the tool will then ask the user to fill in the said fields.

## INSTRUCTIONS
1.  **Read the Attached Template:** Carefully read the attached contract template.
2.  **Reproduce the Content:** Copy the content of the template exactly as it is, including all paragraphs, clauses, and formatting.
3.  **Maintain Placeholders:** Ensure that any variable fields indicated by dots (e.g., ............ ) are reproduced as they appear in the template.
4.  **Preserve Chapters:** Reproduce the contract with the exact same chapters in the same order as they appear in the original template.
5.  **No Modifications:** Do not make any changes to the content, structure, chapter order, or language of the template. The reproduction should be a direct copy.
6.  **Identify Fields and Prompt User:** After reproducing the template, identify all fields marked with dots (e.g., ............) and prompt the user to provide the necessary information to fill these fields.
7.  **Language Independence:** The process should be applied regardless of the language of the contract template.

Please reproduce the attached contract template according to these instructions, ensuring the chapters are maintained exactly as in the original, and then prompt the user to fill in the fields.
`,

  en: `
   It is {{currentDate}}.
  # CONTRACT REPRODUCTION AND FIELD FILLING

## OVERVIEW
This task involves reproducing a contract from a provided template and then prompting the user to fill in the identified variable fields. The objective is to create an exact copy of the template, preserving all formatting, content, and the precise order of chapters, while maintaining the variable fields indicated by dots (e.g., ............). After reproducing the template, the tool will then ask the user to fill in the said fields.

## INSTRUCTIONS
1.  **Read the Attached Template:** Carefully read the attached contract template.
2.  **Reproduce the Content:** Copy the content of the template exactly as it is, including all paragraphs, clauses, and formatting.
3.  **Maintain Placeholders:** Ensure that any variable fields indicated by dots (e.g., ............ ) are reproduced as they appear in the template.
4.  **Preserve Chapters:** Reproduce the contract with the exact same chapters in the same order as they appear in the original template.
5.  **No Modifications:** Do not make any changes to the content, structure, chapter order, or language of the template. The reproduction should be a direct copy.
6.  **Identify Fields and Prompt User:** After reproducing the template, identify all fields marked with dots (e.g., ............) and prompt the user to provide the necessary information to fill these fields.
7.  **Language Independence:** The process should be applied regardless of the language of the contract template.

Please reproduce the attached contract template according to these instructions, ensuring the chapters are maintained exactly as in the original, and then prompt the user to fill in the fields.
    `,
}
