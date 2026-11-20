export function opcionesDe(world, ballita) {
  const origen=typeof ballita==='number'?ballita:ballita?.node
  return { origen, planetas:world.destinos, rutas:world.waysFrom[origen]||[], carriles:[0,1,2,3,4] }
}
