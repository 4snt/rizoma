import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    role?: string
    roleLabels?: Record<string, string>
    error?: string
    userEmail?: string
    userName?: string
    userPicture?: string | null
  }
}
