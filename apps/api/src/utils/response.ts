import { Response } from 'express'

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: object
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  })
}

export const sendCreated = <T>(res: Response, data: T) => {
  return sendSuccess(res, data, 201)
}

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) => {
  return sendSuccess(res, data, 200, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

export const parsePagination = (query: Record<string, any>) => {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}
