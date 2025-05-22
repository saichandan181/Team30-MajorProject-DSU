export const DR_LEVELS = {
  0: 'No DR',
  1: 'Mild DR',
  2: 'Moderate DR',
  3: 'Severe DR',
  4: 'Proliferative DR'
} as const;

export const DR_DESCRIPTIONS = {
  0: 'No visible signs of diabetic retinopathy. Regular screening should continue as recommended by your healthcare provider.',
  1: 'Mild non-proliferative diabetic retinopathy (NPDR) with microaneurysms. Monitor closely and maintain good blood sugar control.',
  2: 'Moderate NPDR with multiple microaneurysms, dot and blot hemorrhages, and hard exudates. More frequent monitoring required.',
  3: 'Severe NPDR with extensive hemorrhages, venous beading, and intraretinal microvascular abnormalities (IRMA). Immediate medical attention needed.',
  4: 'Proliferative diabetic retinopathy (PDR) with neovascularization and potential vitreous hemorrhage. Urgent treatment required.'
} as const;

export const DEFAULT_IMAGE_FILTERS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};