import * as THREE from 'three'

/**
 * Reemplaza la imagen de una textura sin desbordar el almacenamiento WebGL2 inmutable.
 */
export function applyLoadedImage(tex, image) {
  if (!tex || !image) return
  const prev = tex.image
  const sameSize = prev && prev.width === image.width && prev.height === image.height
  if (!sameSize || tex.isDataTexture) {
    // WebGL2 texStorage2D es inmutable: si cambian dimensiones, liberar y recrear Source
    tex.dispose()
    tex.source = new THREE.Source(image)
  } else {
    tex.image = image
  }
  tex.needsUpdate = true
}
