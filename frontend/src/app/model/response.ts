export type CommonResponse<T> = {
    code: number,
    errorMessage?: string,
    data?: T
}
