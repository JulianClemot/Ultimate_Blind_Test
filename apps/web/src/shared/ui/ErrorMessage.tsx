export const ErrorMessage = ({ error }: { error: unknown }) =>
  error ? (
    <p role="alert" className="text-sm text-destructive">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </p>
  ) : null;
