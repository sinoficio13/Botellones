import { test } from '@playwright/test';

test('asignar 2 botellones a CL-0036', async ({ page }) => {
  test.setTimeout(120000);

  // 1. Login
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
  console.log('✅ Login exitoso');

  // 2. Buscar CL-0036
  await page.getByPlaceholder(/Buscar por nombre/).fill('CL-0036');
  await page.getByPlaceholder(/Buscar por nombre/).press('Enter');
  await page.waitForLoadState('networkidle');
  console.log('✅ Búsqueda CL-0036');

  // 3. Click en Jose Fariña
  await page.getByText('Jose Fariña').first().click();
  await page.waitForURL(/\/clientes\//, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  console.log('✅ Perfil de Jose Fariña');

  // 4. Crear 2 botellones y asignarlos
  for (let i = 1; i <= 2; i++) {
    console.log(`\n─── Creando botellón ${i}/2 ───`);
    
    await page.goto('http://localhost:3000/botellones/nuevo');
    await page.waitForLoadState('networkidle');
    
    // Click "Crear botellón"
    await page.getByRole('button', { name: /crear botellón/i }).click();
    
    // Esperar redirect al detalle del botellón
    await page.waitForURL(/\/botellones\/(?!nuevo)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Leer código
    const h1 = page.locator('h1').first();
    const codigo = await h1.textContent();
    console.log(`   📦 ${codigo}`);

    // Asignar cliente
    const clienteSelect = page.locator('select[name="cliente_id"]');
    await clienteSelect.waitFor({ state: 'visible', timeout: 10000 });
    
    // Seleccionar CL-0036 (Jose Fariña)
    // Buscar y seleccionar CL-0036 (Jose Fariña)
    const option = clienteSelect.locator('option').filter({ hasText: 'CL-0036' });
    const value = await option.getAttribute('value');
    if (value) await clienteSelect.selectOption(value);
    console.log('   ✅ Cliente: CL-0036');

    // Cambiar estado a "asignado"
    const estadoSelect = page.locator('select[name="estado"]');
    if (await estadoSelect.isVisible()) {
      await estadoSelect.selectOption('asignado');
      console.log('   ✅ Estado: asignado');
    }

    // Guardar
    await page.getByRole('button', { name: /guardar/i }).click();
    await page.waitForTimeout(1500);
    console.log('   ✅ Guardado');
  }

  console.log('\n✅✅ 2 botellones asignados a CL-0036 (Jose Fariña)');
  
  // Mantener abierto para revisar
  await page.waitForTimeout(15000);
});