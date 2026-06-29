/*
  # Update Status Workflow

  ## Changes
  
  1. **Update status values** in reports table
     - Remove: 'in_execution', 'executed'
     - Add: 'in_review', 'evidence_rejected'
     - Final statuses: 'reported', 'assigned', 'in_review', 'evidence_rejected', 'closed'
  
  2. **New Workflow**
     - reported → assigned (when responsible is assigned)
     - assigned → in_review (automatic when evidence is uploaded)
     - in_review → closed (when SST manager approves)
     - in_review → evidence_rejected (when SST manager rejects)
     - evidence_rejected → in_review (when responsible re-uploads evidence)
  
  3. **Automatic Status Change**
     - When evidence photo is uploaded, status automatically changes to 'in_review'
  
  ## Notes
  - Existing reports with old statuses are migrated to new statuses
  - Trigger ensures seamless workflow without manual status changes
*/

-- Temporarily disable the status change tracking trigger
DROP TRIGGER IF EXISTS trigger_track_report_status ON reports;

-- Update any existing reports with old statuses
UPDATE reports 
SET status = 'assigned' 
WHERE status IN ('in_execution', 'executed');

-- Drop old constraint
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;

-- Add new constraint with updated statuses
ALTER TABLE reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('reported', 'assigned', 'in_review', 'evidence_rejected', 'closed'));

-- Recreate the status change tracking trigger
CREATE TRIGGER trigger_track_report_status
  AFTER UPDATE ON reports
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_report_status_change();

-- Create function to auto-change status when evidence is uploaded
CREATE OR REPLACE FUNCTION auto_change_status_on_evidence()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an evidence photo, change report status to 'in_review'
  IF NEW.is_evidence = true THEN
    UPDATE reports 
    SET status = 'in_review',
        updated_at = now()
    WHERE id = NEW.report_id 
      AND status IN ('assigned', 'evidence_rejected');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic status change
DROP TRIGGER IF EXISTS trigger_auto_status_on_evidence ON report_photos;
CREATE TRIGGER trigger_auto_status_on_evidence
  AFTER INSERT ON report_photos
  FOR EACH ROW
  WHEN (NEW.is_evidence = true)
  EXECUTE FUNCTION auto_change_status_on_evidence();
