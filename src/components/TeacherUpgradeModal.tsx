import React from 'react';
import { UpgradePromptModal } from './UpgradePromptModal';

interface TeacherUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TeacherUpgradeModal: React.FC<TeacherUpgradeModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <UpgradePromptModal
      isOpen={isOpen}
      onClose={onClose}
      customTitle="Paket Guru"
      targetPackage="teacher"
    />
  );
};
