-- Script pour corriger la corruption des fee_type suite à la migration
UPDATE public.payments 
SET fee_type = 
    CASE 
        WHEN type ILIKE '%Inscription%' OR nature ILIKE '%Inscription%' THEN 'INSCRIPTION'
        WHEN type ILIKE '%Divers%' OR nature ILIKE '%Divers%' THEN 'DIVERS'
        WHEN type ILIKE '%Fourniture%' OR nature ILIKE '%Fourniture%' THEN 'FOURNITURE'
        ELSE 'SCOLARITE'
    END
WHERE fee_type = 'SCOLARITE' AND (type ILIKE '%Inscription%' OR nature ILIKE '%Inscription%' OR type ILIKE '%Divers%' OR nature ILIKE '%Divers%' OR type ILIKE '%Fourniture%' OR nature ILIKE '%Fourniture%');
