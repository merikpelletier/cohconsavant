import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function IdentifierModal({ isOpen, onClose, onConfirm, rules }) {
  const [acceptedConditions, setAcceptedConditions] = useState(false);

  const handleConfirm = () => {
    if (acceptedConditions) {
      onConfirm();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-neutral-950 border border-white/10 rounded-sm max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-extralight tracking-widest">
                  IDENTIFIANT TEMPORAIRE
                </h2>
                <button onClick={onClose} className="text-white hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <p className="text-white text-sm mb-6 leading-relaxed">
                Pour participer aux salons, vous devez obtenir un identifiant temporaire.
                Cet identifiant sera supprimé à la fin de votre session.
              </p>

              {rules && (
                <div className="bg-neutral-900 border border-white/10 rounded-sm p-4 mb-6 max-h-64 overflow-y-auto">
                  <ReactMarkdown className="text-white text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {rules}
                  </ReactMarkdown>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="conditions"
                    checked={acceptedConditions}
                    onCheckedChange={setAcceptedConditions}
                    className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black mt-1"
                  />
                  <Label htmlFor="conditions" className="text-white/80 text-sm font-light cursor-pointer">
                   J’accepte les conditions de participation
                  </Label>
                </div>
              </div>

              <Button
               onClick={handleConfirm}
               disabled={!acceptedConditions}
               className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest disabled:opacity-30"
              >
               OBTENIR MON IDENTIFIANT
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
