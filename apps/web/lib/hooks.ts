"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Paper } from "@/lib/types";

const isPending = (paper: Paper) => paper.status === "queued" || paper.status === "processing";

export const keys = {
  papers: ["papers"] as const,
  paper: (id: string) => ["paper", id] as const,
  sections: (id: string) => ["sections", id] as const,
  graph: (id: string) => ["graph", id] as const,
  related: (id: string) => ["related", id] as const,
  conversations: (id: string) => ["conversations", id] as const,
  job: (id: string) => ["job", id] as const,
};

export function usePapers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.papers,
    queryFn: api.papers,
    enabled: Boolean(user),
    refetchInterval: (query) => (query.state.data?.some(isPending) ? 2500 : false),
  });
}

export function usePaper(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.paper(id),
    queryFn: () => api.paper(id),
    enabled: Boolean(user),
    refetchInterval: (query) => (query.state.data && isPending(query.state.data) ? 2000 : false),
  });
}

/** Live pipeline stage ("parsing" → "embedding" → "analyzing") while a paper is processing. */
export function useJobStage(jobId: string | null | undefined, active: boolean) {
  return useQuery({
    queryKey: keys.job(jobId ?? "none"),
    queryFn: () => api.job(jobId!),
    enabled: Boolean(jobId) && active,
    refetchInterval: 1200,
  });
}

export function useSections(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.sections(id), queryFn: () => api.sections(id), enabled });
}

export function useGraph(id: string) {
  return useQuery({ queryKey: keys.graph(id), queryFn: () => api.graph(id), staleTime: 5 * 60_000, retry: 0 });
}

export function useConversations(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.conversations(id), queryFn: () => api.conversations(id), enabled });
}

export function useAddPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File } | { arxiv: string }) =>
      "file" in input ? api.uploadPaper(input.file) : api.addArxiv(input.arxiv),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.papers }),
  });
}

export function useDeletePaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deletePaper,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.papers }),
  });
}

export function useRetryPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.retryJob,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
