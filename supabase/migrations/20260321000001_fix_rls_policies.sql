-- Allow users to delete their own in-progress attempts (for retakes)
create policy "Users can delete own in-progress attempts"
  on test_attempts for delete using (auth.uid() = user_id and status = 'in_progress');
