export type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    role: string
  }
}

export type ApiResponse<T> = {
  data: T
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
}
