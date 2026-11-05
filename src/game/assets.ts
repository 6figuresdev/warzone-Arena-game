/** Where the game's static files live. They are served from the project's public/assets folder. */
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`.replace(/\/{2,}/g, '/')

export const MODEL_PATH = 'public/assets/models/operator.glb'
export const MODEL_URL = assetUrl('models/operator.glb')
