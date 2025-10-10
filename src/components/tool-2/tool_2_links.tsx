"use client";

import { NextPage } from "next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloseCircle, Trash, Note, TickCircle } from "iconsax-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import { cn, formatDateToCustomFormat } from "@/lib/utils";
import { toast } from "sonner";
import { Suspense, useState } from "react";
import HistoryHeader from "../misc/history_header";
import { useLocale } from "next-intl";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import ChatHistoryLoader from "../chat/chat_history_loader";
import {
  deleteTool2Chat,
  updateTool2Note,
} from "@/app/[locale]/actions/tool_2_actions";
import CreateNewTool2Chat from "./create_new_tool_2_chat";

interface Props {
  tool2: any;
  tool2Translations: {
    selectResearchForChatHistory: string;
    note?: string;
    history: string;
    massDelete: string;
    cancel: string;
    accept: string;
    deleteConfirmation: string;
    deleteToastSuccess: string;
    deleteToastLoading: string;
    massDeleteToastSuccess: string;
    massDeleteToastLoading: string;
  };
}

const Tool2Links: NextPage<Props> = ({ tool2, tool2Translations }) => {
  const path = usePathname();
  const [selectedTool2Chats, setSelectedTool2Chats] = useState<string[]>([]);
  const [isMassDelete, setIsMassDelete] = useState(false);
  const [visibleNoteTool2Id, setVisibleNoteTool2Id] = useState<string | null>(
    null
  );
  const [notes, setNotes] = useState<{ [tool2Id: string]: string }>({});
  const locale = useLocale() || "el";

  const handleCheckboxChange = (tool2Id: string) => {
    setSelectedTool2Chats((prev) =>
      prev.includes(tool2Id)
        ? prev.filter((id) => id !== tool2Id)
        : [...prev, tool2Id]
    );
  };

  const handleMassDelete = async () => {
    try {
      toast.promise(
        Promise.all(
          selectedTool2Chats.map((tool2Id) => deleteTool2Chat(tool2Id))
        ),
        {
          loading: `${tool2Translations.massDeleteToastLoading}...`,
          success: tool2Translations.massDeleteToastSuccess,
          error: "Oops! Couldn't Delete, try again",
        }
      );
      setSelectedTool2Chats([]);
      setIsMassDelete(false);
    } catch {
      toast.error("Failed to delete selected case studies, please try again.");
    }
  };

  const toggleNoteVisibility = (tool2Id: string) => {
    setVisibleNoteTool2Id((prev) => (prev === tool2Id ? null : tool2Id));
  };

  const handleSaveNote = async (tool2Id: string, note: string) => {
    try {
      await updateTool2Note(tool2Id, note);
      setNotes((prevNotes) => ({
        ...prevNotes,
        [tool2Id]: note,
      }));
      toast.success("Note saved successfully.");
    } catch (error) {
      toast.error("Failed to save the note. Please try again.");
    }
    setVisibleNoteTool2Id(null);
  };

  return (
    <div>
      <div className="md:hidden flex w-full justify-between px-4 py-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm">
              {tool2Translations.history}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="relative flex flex-col items-center">
              <DrawerClose asChild>
                <button className="absolute right-2 top-1 md:hidden">
                  <CloseCircle className="h-6 w-6" />
                </button>
              </DrawerClose>
              <DrawerTitle className="w-full text-center">
                {tool2Translations.history}
              </DrawerTitle>
              <DrawerDescription>
                {tool2Translations.selectResearchForChatHistory}
              </DrawerDescription>
            </DrawerHeader>
            <Suspense fallback={<ChatHistoryLoader />}>
              <div className="overflow-y-scroll max-h-[83svh] no-scrollbar ">
                {tool2.length > 0 && (
                  <HistoryHeader
                    selectedChats={selectedTool2Chats}
                    handleMassDelete={handleMassDelete}
                    setSelectedChats={setSelectedTool2Chats}
                    isMassDelete={isMassDelete}
                    setIsMassDelete={setIsMassDelete}
                    chatHistoryTranslations={tool2Translations}
                  />
                )}

                {tool2.map((tool2Chat: any) => (
                  <div
                    className={cn(
                      "py-3 hover:cursor-pointer px-2 flex flex-col justify-center items-center",
                      {
                        "border-r-2 border-primary bg-slate-200": path.endsWith(
                          tool2Chat.id
                        ),
                      }
                    )}
                    key={tool2Chat.id}
                  >
                    <div className="flex space-x-4 justify-between items-center w-full">
                      {isMassDelete && (
                        <input
                          type="checkbox"
                          checked={selectedTool2Chats.includes(tool2Chat.id)}
                          onChange={() => handleCheckboxChange(tool2Chat.id)}
                        />
                      )}
                      {visibleNoteTool2Id === tool2Chat.id ? (
                        <Link
                          href={`/${locale}/tool-2/${tool2Chat.id}`}
                          className="w-full"
                        >
                          <div className="w-full">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="min-w-1/2">
                                    <p className="text-sm font-medium line-clamp-2">
                                      {tool2Chat.title}
                                    </p>
                                    <input
                                      type="text"
                                      maxLength={80}
                                      placeholder={tool2Translations.note}
                                      value={
                                        notes[tool2Chat.id] ||
                                        tool2Chat.note ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setNotes((prevNotes) => ({
                                          ...prevNotes,
                                          [tool2Chat.id]: e.target.value,
                                        }))
                                      }
                                      className="w-full text-xs text-[#c2032f] placeholder:text-[#c2032f] border-b border-dashed border-[#c2032f] bg-transparent focus:outline-none focus:border-solid my-1"
                                    />
                                    <p className="text-xs text-slate-500">
                                      {formatDateToCustomFormat(
                                        tool2Chat.createdAt!
                                      )}
                                    </p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 w-[280px]">
                                  <p>{tool2Chat.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </Link>
                      ) : (
                        <DrawerClose asChild>
                          <Link
                            href={`/${locale}/tool-2/${tool2Chat.id}`}
                            className="w-full"
                          >
                            <div className="w-full">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="min-w-1/2">
                                      <p className="text-sm font-medium line-clamp-2">
                                        {tool2Chat.title}
                                      </p>
                                      {tool2Chat.note && (
                                        <p className="text-xs text-[#c2032f] my-1">
                                          {tool2Chat.note}
                                        </p>
                                      )}
                                      <p className="text-xs text-slate-500">
                                        {formatDateToCustomFormat(
                                          tool2Chat.createdAt!
                                        )}
                                      </p>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 w-[280px]">
                                    <p>{tool2Chat.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </Link>
                        </DrawerClose>
                      )}

                      {!isMassDelete && (
                        <div className="flex items-center space-x-2">
                          {visibleNoteTool2Id === tool2Chat.id ? (
                            <TickCircle
                              size={15}
                              className="cursor-pointer"
                              onClick={() =>
                                handleSaveNote(
                                  tool2Chat.id,
                                  notes[tool2Chat.id] || tool2Chat.note || ""
                                )
                              }
                            />
                          ) : (
                            <Note
                              size={15}
                              className="cursor-pointer"
                              onClick={() => toggleNoteVisibility(tool2Chat.id)}
                            />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Trash
                                size={15}
                                variant="Broken"
                                className="cursor-pointer"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                className="text-xs"
                                onClick={() => {
                                  toast.promise(deleteTool2Chat(tool2Chat.id), {
                                    loading: `${tool2Translations.deleteToastLoading}...`,
                                    success:
                                      tool2Translations.deleteToastSuccess,
                                    error: "Oops! Couldn't Delete, try again",
                                  });
                                }}
                              >
                                {tool2Translations.deleteConfirmation}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Suspense>
            <DrawerFooter>{/* Add footer buttons if needed */}</DrawerFooter>
          </DrawerContent>
        </Drawer>
        <CreateNewTool2Chat />
      </div>
      <div className="md:block hidden">
        {tool2.length > 0 && (
          <HistoryHeader
            selectedChats={selectedTool2Chats}
            handleMassDelete={handleMassDelete}
            setSelectedChats={setSelectedTool2Chats}
            isMassDelete={isMassDelete}
            setIsMassDelete={setIsMassDelete}
            chatHistoryTranslations={tool2Translations}
          />
        )}

        {tool2.map((tool2Chat: any) => (
          <div
            className={cn(
              "py-3 hover:cursor-pointer px-2 flex flex-col justify-center items-center",
              {
                "border-r-2 border-primary bg-slate-200": path.endsWith(
                  tool2Chat.id
                ),
              }
            )}
            key={tool2Chat.id}
          >
            <div className="flex space-x-4 justify-between items-center w-full">
              {isMassDelete && (
                <input
                  type="checkbox"
                  checked={selectedTool2Chats.includes(tool2Chat.id)}
                  onChange={() => handleCheckboxChange(tool2Chat.id)}
                />
              )}

              <Link
                href={`/${locale}/tool-2/${tool2Chat.id}`}
                className="w-full"
              >
                <div className="w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="min-w-1/2">
                          <p className="text-sm font-medium line-clamp-2">
                            {tool2Chat.title}
                          </p>
                          {visibleNoteTool2Id === tool2Chat.id ? (
                            <input
                              type="text"
                              maxLength={80}
                              placeholder={tool2Translations.note}
                              value={
                                notes[tool2Chat.id] || tool2Chat.note || ""
                              }
                              onChange={(e) =>
                                setNotes((prevNotes) => ({
                                  ...prevNotes,
                                  [tool2Chat.id]: e.target.value,
                                }))
                              }
                              className="w-full text-xs text-[#c2032f] placeholder:text-[#c2032f] border-b border-dashed border-[#c2032f] bg-transparent focus:outline-none focus:border-solid my-1"
                            />
                          ) : (
                            tool2Chat.note && (
                              <p className="text-xs text-[#c2032f] my-1">
                                {tool2Chat.note}
                              </p>
                            )
                          )}
                          <p className="text-xs text-slate-500">
                            {formatDateToCustomFormat(tool2Chat.createdAt!)}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 w-[280px]">
                        <p>{tool2Chat.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </Link>

              {!isMassDelete && (
                <div className="flex items-center space-x-2">
                  {visibleNoteTool2Id === tool2Chat.id ? (
                    <TickCircle
                      size={15}
                      className="cursor-pointer"
                      onClick={() =>
                        handleSaveNote(
                          tool2Chat.id,
                          notes[tool2Chat.id] || tool2Chat.note || ""
                        )
                      }
                    />
                  ) : (
                    <Note
                      size={15}
                      className="cursor-pointer"
                      onClick={() => toggleNoteVisibility(tool2Chat.id)}
                    />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Trash
                        size={15}
                        variant="Broken"
                        className="cursor-pointer"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={() => {
                          toast.promise(deleteTool2Chat(tool2Chat.id), {
                            loading: `${tool2Translations.deleteToastLoading}...`,
                            success: tool2Translations.deleteToastSuccess,
                            error: "Oops! Couldn't Delete, try again",
                          });
                        }}
                      >
                        {tool2Translations.deleteConfirmation}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tool2Links;
