
import { ProposalPreset } from '@types';

export const PET_GROOMING_MASTER_BOOK: Omit<ProposalPreset, 'id' | 'organizationId'>[] = [
    // --- 1. BATH & BRUSH PACKAGES (Double Bath, Condition, Blow Dry, Brush, Nails, Ears) ---
    { name: 'Bath & Brush - Small Dog (< 15 lbs)', description: 'Chihuahua, Yorkie, etc. Includes bath, blow dry, brush out, nail trim, and ear cleaning.', baseCost: 1.50, avgLabor: 0.75, category: 'Bath Service' },
    { name: 'Bath & Brush - Medium Dog (16 - 35 lbs)', description: 'Beagle, Corgi, etc. Includes bath, blow dry, brush out, nail trim, and ear cleaning.', baseCost: 2.00, avgLabor: 1.0, category: 'Bath Service' },
    { name: 'Bath & Brush - Large Dog (36 - 60 lbs)', description: 'Boxer, Pitbull, etc. Includes bath, blow dry, brush out, nail trim, and ear cleaning.', baseCost: 3.00, avgLabor: 1.25, category: 'Bath Service' },
    { name: 'Bath & Brush - X-Large Dog (61 - 90 lbs)', description: 'Labrador, Golden Retriever, etc. Includes bath, blow dry, brush out, nail trim, and ear cleaning.', baseCost: 4.50, avgLabor: 1.5, category: 'Bath Service' },
    { name: 'Bath & Brush - Giant Dog (91+ lbs)', description: 'Great Dane, Mastiff, etc. Includes bath, blow dry, brush out, nail trim, and ear cleaning.', baseCost: 6.00, avgLabor: 2.0, category: 'Bath Service' },
    { name: 'Bath & Brush - Double Coated Small (Pomeranian)', description: 'Specialized blowout for double coats. Includes bath, deshedding conditioner, and extensive brushing.', baseCost: 2.50, avgLabor: 1.25, category: 'Bath Service' },
    { name: 'Bath & Brush - Double Coated Med (Sheltie/Shiba)', description: 'Specialized blowout for double coats. Includes bath, deshedding conditioner, and extensive brushing.', baseCost: 3.50, avgLabor: 1.5, category: 'Bath Service' },
    { name: 'Bath & Brush - Double Coated Large (Husky/Shepherd)', description: 'Specialized blowout for double coats. Includes bath, deshedding conditioner, and extensive brushing.', baseCost: 5.00, avgLabor: 2.0, category: 'Bath Service' },
    { name: 'Bath & Brush - Double Coated Giant (Malamute/Newfie)', description: 'Specialized blowout for double coats. Includes bath, deshedding conditioner, and extensive brushing.', baseCost: 8.00, avgLabor: 3.0, category: 'Bath Service' },
    { name: 'Puppy Introduction (Bath & Tidy)', description: 'For puppies under 5 months. Gentle bath, fluff dry, face trim, feet trim, and sanitary trim.', baseCost: 1.50, avgLabor: 1.0, category: 'Bath Service' },

    // --- 2. FULL SERVICE GROOMING (Haircuts) ---
    { name: 'Full Groom - Small Dog (< 15 lbs)', description: 'Full body haircut, bath, blow dry, nails, ears. Breed standard or pet clip.', baseCost: 2.00, avgLabor: 1.25, category: 'Grooming' },
    { name: 'Full Groom - Medium Dog (16 - 35 lbs)', description: 'Full body haircut, bath, blow dry, nails, ears. Breed standard or pet clip.', baseCost: 2.50, avgLabor: 1.5, category: 'Grooming' },
    { name: 'Full Groom - Large Dog (36 - 60 lbs)', description: 'Full body haircut, bath, blow dry, nails, ears. Breed standard or pet clip.', baseCost: 4.00, avgLabor: 2.0, category: 'Grooming' },
    { name: 'Full Groom - X-Large Dog (61 - 90 lbs)', description: 'Full body haircut, bath, blow dry, nails, ears. Breed standard or pet clip.', baseCost: 5.50, avgLabor: 2.5, category: 'Grooming' },
    { name: 'Full Groom - Giant Dog (91+ lbs)', description: 'Full body haircut, bath, blow dry, nails, ears. Breed standard or pet clip.', baseCost: 7.00, avgLabor: 3.5, category: 'Grooming' },
    { name: 'Doodle Groom - Mini (< 25 lbs)', description: 'Specialized cut for Poodle mixes. Includes extensive prep, scissor finish, and styling.', baseCost: 3.00, avgLabor: 1.75, category: 'Grooming' },
    { name: 'Doodle Groom - Medium (26 - 50 lbs)', description: 'Specialized cut for Poodle mixes. Includes extensive prep, scissor finish, and styling.', baseCost: 4.00, avgLabor: 2.25, category: 'Grooming' },
    { name: 'Doodle Groom - Standard (51+ lbs)', description: 'Specialized cut for Poodle mixes. Includes extensive prep, scissor finish, and styling.', baseCost: 6.00, avgLabor: 3.0, category: 'Grooming' },
    { name: 'Poodle Cut - Standard (Show Pattern)', description: 'Complex breed trims (Continental, English Saddle). Scissors only finish.', baseCost: 5.00, avgLabor: 4.0, category: 'Grooming' },
    { name: 'Hand Stripping (Terriers)', description: 'Manual removal of dead hair to maintain coat texture. Charged per hour.', baseCost: 2.00, avgLabor: 1.0, category: 'Grooming' },

    // --- 3. FACE, FEET & SANITARY (Partial Grooms) ---
    { name: 'Face, Feet, & Fanny (Small)', description: 'Trimming of eyes, paw pads, feet shaping, and sanitary area. No body length off.', baseCost: 1.00, avgLabor: 0.5, category: 'Maintenance' },
    { name: 'Face, Feet, & Fanny (Large)', description: 'Trimming of eyes, paw pads, feet shaping, and sanitary area. No body length off.', baseCost: 1.50, avgLabor: 0.75, category: 'Maintenance' },
    { name: 'Sanitary Trim Only', description: 'Shaving of groin and rectal area for hygiene.', baseCost: 0.50, avgLabor: 0.2, category: 'Maintenance' },
    { name: 'Face Trim Only', description: 'Trimming visor/eyes and beard.', baseCost: 0.50, avgLabor: 0.25, category: 'Maintenance' },
    { name: 'Paw Pad Shave & Foot Rounding', description: 'Shaving hair between pads and scissoring foot shape.', baseCost: 0.50, avgLabor: 0.25, category: 'Maintenance' },

    // --- 4. NAIL CARE ---
    { name: 'Nail Trim (Clip Only)', description: 'Clipping nails to the quick.', baseCost: 0.00, avgLabor: 0.2, category: 'Nails' },
    { name: 'Nail Grinding (Dremel)', description: 'Filing nails smooth and short using a rotary tool.', baseCost: 1.00, avgLabor: 0.3, category: 'Nails' },
    { name: 'Nail Polish Application', description: 'Application of pet-safe nail polish.', baseCost: 2.00, avgLabor: 0.3, category: 'Nails' },
    { name: 'Nail Cap Application (Front Only)', description: 'Application of Soft Paws/vinyl caps to front claws.', baseCost: 12.00, avgLabor: 0.5, category: 'Nails' },
    { name: 'Nail Cap Application (Full Set)', description: 'Application of Soft Paws/vinyl caps to all claws.', baseCost: 18.00, avgLabor: 0.75, category: 'Nails' },

    // --- 5. SKIN & COAT TREATMENTS ---
    { name: 'De-Shedding Treatment - Small', description: 'Furminator shampoo/conditioner + high velocity blowout + 20 min brush.', baseCost: 4.00, avgLabor: 0.5, category: 'Treatment' },
    { name: 'De-Shedding Treatment - Medium', description: 'Furminator shampoo/conditioner + high velocity blowout + 30 min brush.', baseCost: 6.00, avgLabor: 0.75, category: 'Treatment' },
    { name: 'De-Shedding Treatment - Large', description: 'Furminator shampoo/conditioner + high velocity blowout + 45 min brush.', baseCost: 8.00, avgLabor: 1.0, category: 'Treatment' },
    { name: 'De-Shedding Treatment - Giant', description: 'Furminator shampoo/conditioner + high velocity blowout + 60 min brush.', baseCost: 12.00, avgLabor: 1.5, category: 'Treatment' },
    { name: 'De-Matting Service (Per 15 Mins)', description: 'Careful removal of mats. Note: Severe matting requires shaving.', baseCost: 2.00, avgLabor: 0.25, category: 'Treatment' },
    { name: 'Flea & Tick Bath - Small', description: 'Natural pesticide shampoo soak. Does not prevent future infestation.', baseCost: 5.00, avgLabor: 0.5, category: 'Treatment' },
    { name: 'Flea & Tick Bath - Large', description: 'Natural pesticide shampoo soak. Does not prevent future infestation.', baseCost: 8.00, avgLabor: 0.75, category: 'Treatment' },
    { name: 'Skunk Odor Removal', description: 'Enzymatic de-skunking soak and treatment.', baseCost: 15.00, avgLabor: 1.0, category: 'Treatment' },
    { name: 'Medicated Bath (Chlorhexidine/Oatmeal)', description: 'Soak in veterinary grade shampoo for skin issues.', baseCost: 4.00, avgLabor: 0.25, category: 'Treatment' },
    { name: 'Deep Conditioning Treatment', description: 'Leave-in or rinse-out deep conditioner for dry coats.', baseCost: 3.00, avgLabor: 0.2, category: 'Treatment' },

    // --- 6. ADD-ONS & SPA SERVICES ---
    { name: 'Teeth Brushing & Breath Spray', description: 'Brushing with enzymatic toothpaste and fresh breath spray.', baseCost: 1.50, avgLabor: 0.1, category: 'Add-on' },
    { name: 'Anal Gland Expression (External)', description: 'External expression of anal sacs.', baseCost: 0.50, avgLabor: 0.1, category: 'Add-on' },
    { name: 'Ear Plucking & Cleaning', description: 'Removal of excess hair from ear canal and cleaning wax.', baseCost: 0.50, avgLabor: 0.2, category: 'Add-on' },
    { name: 'Blueberry Facial', description: 'Exfoliating and tear-stain reducing face scrub.', baseCost: 2.00, avgLabor: 0.1, category: 'Add-on' },
    { name: 'Paw Balm Application', description: 'Moisturizing wax for cracked pads.', baseCost: 1.00, avgLabor: 0.05, category: 'Add-on' },
    { name: 'Creative Dye - Ears/Tail (Temporary)', description: 'Application of pet-safe temporary color.', baseCost: 8.00, avgLabor: 0.5, category: 'Add-on' },
    { name: 'Creative Dye - Permanent (Per Section)', description: 'Professional permanent color application (requires time).', baseCost: 15.00, avgLabor: 1.0, category: 'Add-on' },
    { name: 'Feather Extension', description: 'Installation of hair feather extension.', baseCost: 5.00, avgLabor: 0.1, category: 'Add-on' },

    // --- 7. CAT GROOMING ---
    { name: 'Cat Bath & Brush - Short Hair', description: 'Degreasing bath, blow dry, ear clean, nail trim.', baseCost: 3.00, avgLabor: 1.0, category: 'Cat' },
    { name: 'Cat Bath & Brush - Long Hair', description: 'Degreasing bath, blow dry, comb out, ear clean, nail trim.', baseCost: 4.00, avgLabor: 1.5, category: 'Cat' },
    { name: 'Cat Lion Cut', description: 'Full body shave leaving mane, tail tuft, and boots. Includes bath.', baseCost: 5.00, avgLabor: 1.5, category: 'Cat' },
    { name: 'Cat Comb Cut', description: 'Length trim using snap-on combs (Must be mat-free).', baseCost: 5.00, avgLabor: 1.75, category: 'Cat' },
    { name: 'Cat Sanitary Trim', description: 'Shave of rear end area.', baseCost: 0.50, avgLabor: 0.25, category: 'Cat' },
    { name: 'Cat Nail Trim', description: 'Clipping of cat claws.', baseCost: 0.00, avgLabor: 0.2, category: 'Cat' },
    { name: 'Cat Soft Paws (Front)', description: 'Application of vinyl nail caps to front claws.', baseCost: 12.00, avgLabor: 0.5, category: 'Cat' },

    // --- 8. HANDLING & MISC ---
    { name: 'Special Handling - Aggressive/Difficult', description: 'Additional charge for dogs requiring muzzle or extra staff assistance.', baseCost: 0.00, avgLabor: 0.5, category: 'Fee' },
    { name: 'Special Handling - Senior/Geriatric', description: 'Extra time and care for elderly pets requiring support.', baseCost: 0.00, avgLabor: 0.5, category: 'Fee' },
    { name: 'Matting Fee (Severe - Shave Down)', description: 'Charge for pre-shaving dirty/matted coat before bath to save equipment.', baseCost: 15.00, avgLabor: 0.5, category: 'Fee' },
    { name: 'Flea Clean-Up Fee', description: 'Mandatory salon sanitization fee if fleas are found mid-groom.', baseCost: 10.00, avgLabor: 0.5, category: 'Fee' },
    { name: 'Express Groom (Straight Through)', description: 'Priority service, no kennel time. Pet is worked on start to finish.', baseCost: 0.00, avgLabor: 0.0, category: 'Fee' },
    { name: 'Late Pick-Up Fee (Per 30 Mins)', description: 'Boarding fee for pets left past closing or agreed pickup window.', baseCost: 0.00, avgLabor: 0.5, category: 'Fee' },
    { name: 'Trip Charge (Mobile Grooming)', description: 'Standard travel fee for mobile service within radius.', baseCost: 10.00, avgLabor: 0.5, category: 'Fee' },
];
