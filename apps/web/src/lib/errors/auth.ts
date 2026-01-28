export const getAuthErrorMessage = (error: any): string => {
  const errorCode = error?.status || error?.code

  switch (errorCode) {
    case 400:
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'Invalid email or password. Please try again.'

    case 409:
    case 'USER_EXISTS':
      return 'An account with this email already exists.'

    case 422:
    case 'WEAK_PASSWORD':
      return 'Password is too weak. Please use a stronger password.'

    case 429:
      return 'Too many attempts. Please try again later.'

    case 'EMAIL_NOT_CONFIRMED':
      return 'Please confirm your email address before signing in.'

    default:
      return error?.message || 'An unexpected error occurred. Please try again.'
  }
}
