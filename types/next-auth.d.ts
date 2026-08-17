import "next-auth"
import type { RoleLabelEntry } from "@/lib/role-labels"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    role?: string
    roleLabels?: RoleLabelEntry[]
    error?: string
    userEmail?: string
    userName?: string
    userPicture?: string | null
  }
}
