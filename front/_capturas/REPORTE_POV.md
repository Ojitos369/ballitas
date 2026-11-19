# REPORTE POV — una sola vista «POV» y diálogos en POV de espalda

Conocimiento consultado: grafica_3d/mds/camara_de_seguimiento_sin_oclusion.md, ui_visual/mds/vista_limpia_con_jerarquia_de_foco.md

## Qué cambió
- **Un único botón «🎥 POV / ↩ POV»** en la tarjeta (normal y compacta); se quitó «👁 Seguir». El ojo de la lista de ballitas y el botón de los caminos abren el POV. Tecla V entra o sale del POV; 3 abre la vista de ballita (POV); Esc y «↩ POV» vuelven a la vista libre.
- `Main` tiene un solo estado (`vista === 'ballita'` ⇒ `pov`); ya no existe `punto` externa/interna.
- `Scene`/`CameraRig`: la cámara decide **por cuadro** si la ballita está en un planeta (`phase !== 'travel'` y `node` entero, la misma regla que `enNodo` del seguimiento). En carretera usa el POV; en planeta, la cámara de seguimiento actual (tres cuartos). El cambio se avisa a React (`onPlaneta`) para los gestos, el panel/joystick del POV y los bocadillos.
  - Entrada al planeta: la entrada existente («entrando», 1,1 s). Si el POV estaba en ojos, la entrada arranca 1,2 u detrás de la ballita para no dar medio giro.
  - Salida a la carretera: transición nueva de 0,9 s (posición en S y giro a 6/s); si la ballita saltó > 14 u (puerto/portal), corte. El zoom del POV se recuerda al volver (no se reinicia al cruzar el borde del planeta).
- `povLook.povZoomView` devuelve `espalda` (cámara a ≥ 50 % de la distancia de espalda: cuerpo entero visible). `Ballita` muestra el bocadillo de la seleccionada en POV si `espalda`; en ojos sigue oculto.
- Prueba nueva en `povLook.test.js` (umbral único, siempre con el cuerpo visible).

## Métricas
Protocolo: build de producción con preview `4303`; sonda cuadro a cuadro durante ventanas de 3 s tras cada cambio. Escritorio 1280×720 y móvil 412×915. `en cuadro` exige la proyección actualizada de `selected.pos` con |x|≤1, |y|≤1 y −1<z<1. Se descartó la medición por mera cercanía.

- **A/B del ajuste pendiente, escritorio:** sin él, promedio 95.7 % en los primeros seis cambios; con él, 97.4 % en la primera comparación. La pasada final quedó en 100 % en las seis transiciones seleccionadas (3 entradas y 3 salidas), peor cuadro 75 ms.
- **Móvil, 3 entradas y 3 salidas tras el cambio inicial de arranque:** 100 % en los seis eventos; peor cuadro 50.1 ms. La primera salida de arranque se reporta aparte: 43.1 % (103/181 cuadros), porque inicia con la cámara cerca y mirando desde la vista previa. El total del ciclo completo da 98.7 %.
- **Modo automático:** en carretera `pov`; al entrar al planeta `entrando > siguiendo`; regresa a `pov` al salir. Sin selección manual de modo.
- **Bocadillo:** espalda visible; alto máximo 5.6 % en escritorio y 4.4 % en móvil; 0 solapes con tarjeta o joystick en ambos. En zoom de ojos: 0 bocadillos.
- Hubo respuestas 500 de `/api/catalogo` y `/api/mundos` (`127.0.0.1:8000` no disponible); la escena 3D y la medición se completaron.

## Ajuste y capturas
- CameraRig acompaña el desplazamiento de la ballita fuera de la rama de transición y centra la espalda tras mover/resolver colisiones. En móvil vertical abre el campo de visión 10° para conservar el encuadre lateral.
- `desk_carretera_espalda.jpg`: ballita centrada sobre la carretera y bocadillo sobre su cabeza.
- `movil_carretera_espalda.jpg`: ballita grande en primer plano; bocadillo separado de la tarjeta y el joystick.
- `desk_entrada_planeta.jpg`: llegada con la ballita visible delante de la superficie del planeta.
- `desk_salida_carretera.jpg`: carretera y POV de espalda restablecidos tras salir del planeta.
- `movil_entrada_planeta.jpg`: planeta reconocible y diálogo legible sobre la ballita.
- `movil_salida_carretera.jpg`: regreso a carretera con el cuerpo visible y el diálogo encima.
- `movil_pov_ojos_sin_bocadillo.jpg`: vista de ojos sin bocadillo.

## Validación
- `npx vite build` tras merge: correcto (advertencia de bundle >500 kB).
- `pnpm test` previo a merge: 76/77; falló solo `sim.test.js:446` por 3389 ms frente al tope de 3000 ms. Repetición aislada: pasó en 2808.7 ms. Tras integrar `main`: 78/78 pasaron (268.2 s).
- Hash del commit de integración validado: `c1eddb8da8bfd511f20cbebdd2359b774ec70281`.


