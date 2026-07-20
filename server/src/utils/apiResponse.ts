export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export const formatResponse = <T>(data: T, message?: string): ApiResponse<T> => {
  return {
    success: true,
    message,
    data
  };
};

export const formatError = (error: string): ApiResponse => {
  return {
    success: false,
    error
  };
};
