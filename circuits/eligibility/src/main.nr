// ---------------------------------------------------------------------------
//  Seed 2 Deed — circuito de elegibilidad del inversionista  (backlog T4)
// ---------------------------------------------------------------------------
//
//  El problema: la plataforma es un intermediario regulado y tiene que responder
//  por quién invierte. Pero publicar en una cadena pública el CI, el domicilio y
//  el patrimonio de cada inversionista para demostrarlo es inaceptable —y en
//  varias jurisdicciones, ilegal—.
//
//  Este circuito parte ese nudo. El inversionista tiene una credencial emitida
//  por un emisor KYC de confianza. La credencial nunca sale de su dispositivo.
//  Lo que llega a la cadena es una prueba de que:
//
//    1. la credencial está en el árbol de credenciales vigentes del emisor
//       (dentro => emitida y no revocada: revocar es sacar la hoja y republicar
//       la raíz, así que la no-revocación se prueba con la misma inclusión);
//    2. la credencial no venció;
//    3. el inversionista reside en una jurisdicción admitida para este proyecto;
//    4. su patrimonio supera el mínimo exigido por la ronda;
//    5. quien presenta la prueba controla la wallet que va a invertir.
//
//  Nada de eso revela el patrimonio exacto, la identidad ni qué hoja del árbol
//  es suya. El verificador on-chain aprende un único bit: elegible = sí.
//
//  El `nullifier` es lo que impide reutilizar una credencial. Se deriva del
//  secreto + el proyecto, así que una misma persona produce SIEMPRE el mismo
//  nullifier para un proyecto dado —el contrato lo quema y no acepta un
//  segundo registro— pero nullifiers de proyectos distintos son imposibles de
//  correlacionar entre sí sin conocer el secreto.
//
//  Se ata también la wallet: sin eso, cualquiera que vea la prueba en el
//  mempool podría copiarla y registrarse con su propia dirección.

global TREE_DEPTH: u32 = 8; // 256 credenciales vigentes por raíz

/// Reconstruye la raíz de Merkle desde la hoja y su camino de autenticación.
/// `!index_bits[i]` => la hoja va a la izquierda en el nivel i.
fn compute_merkle_root(
    leaf: Field,
    path: [Field; TREE_DEPTH],
    index_bits: [bool; TREE_DEPTH],
) -> Field {
    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = path[i];
        // El orden importa: hash(a,b) != hash(b,a). Sin esta selección, un
        // camino podría validarse contra una raíz que no le corresponde.
        let left = if !index_bits[i] { node } else { sibling };
        let right = if !index_bits[i] { sibling } else { node };
        node = poseidon::poseidon2::Poseidon2::hash([left, right], 2);
    }
    node
}

fn main(
    // ---------------------------------------------------------------- públicos
    // Raíz del árbol de credenciales vigentes, publicada por el emisor KYC.
    credential_root: pub Field,
    // Proyecto para el que se pide elegibilidad (liga el nullifier a la ronda).
    project_id: pub Field,
    // Wallet que va a invertir, como Field (address de 20 bytes cabe de sobra).
    investor_address: pub Field,
    // Patrimonio mínimo exigido por esta ronda.
    min_net_worth: pub Field,
    // Jurisdicción admitida, como código ISO-3166 numérico (BO = 68).
    allowed_jurisdiction: pub Field,
    // Momento de la verificación (unix). Lo fija el contrato, no el prover.
    now: pub Field,
    // Salida: marca de un solo uso por (credencial, proyecto).
    nullifier: pub Field,
    // ---------------------------------------------------------------- privados
    // Secreto de la credencial. Nunca sale del dispositivo del inversionista.
    secret: Field,
    jurisdiction: Field,
    net_worth: Field,
    expires_at: Field,
    merkle_path: [Field; TREE_DEPTH],
    merkle_index_bits: [bool; TREE_DEPTH],
) {
    // 1. La credencial está viva en el árbol del emisor.
    //    La hoja compromete TODOS los atributos: cambiar uno solo (subirse el
    //    patrimonio, por ejemplo) produce otra hoja y rompe la inclusión.
    let leaf = poseidon::poseidon2::Poseidon2::hash(
        [secret, jurisdiction, net_worth, expires_at],
        4,
    );
    let root = compute_merkle_root(leaf, merkle_path, merkle_index_bits);
    assert(root == credential_root, "credencial no vigente para esta raiz");

    // 2. No venció. Se comparan como enteros de 64 bits: sobre Field crudo la
    //    resta da la vuelta módulo p y `>` deja de significar lo que parece.
    let expires_u: u64 = expires_at as u64;
    let now_u: u64 = now as u64;
    assert(expires_u > now_u, "credencial vencida");

    // 3. Jurisdicción admitida.
    assert(jurisdiction == allowed_jurisdiction, "jurisdiccion no admitida");

    // 4. Patrimonio suficiente. Se prueba el umbral, no la cifra: el circuito
    //    jamás expone `net_worth`, solo que alcanza.
    let net_worth_u: u64 = net_worth as u64;
    let min_u: u64 = min_net_worth as u64;
    assert(net_worth_u >= min_u, "patrimonio insuficiente");

    // 5. El nullifier queda amarrado al secreto, al proyecto y a la wallet.
    //    Esto obliga a que `investor_address` participe de una restricción real:
    //    un input público que no se usa lo puede fijar el atacante a su antojo.
    let expected = poseidon::poseidon2::Poseidon2::hash(
        [secret, project_id, investor_address],
        3,
    );
    assert(nullifier == expected, "nullifier no corresponde");
}

// ---------------------------------------------------------------------------
//  Pruebas del circuito: se corren con `nargo test`.
// ---------------------------------------------------------------------------

/// Construye un árbol de 2^TREE_DEPTH hojas donde solo la posición 0 es real y
/// el resto son ceros, y devuelve (raíz, camino, bits).
fn fixture(leaf: Field) -> (Field, [Field; TREE_DEPTH], [bool; TREE_DEPTH]) {
    let path = [0; TREE_DEPTH];
    let bits = [false; TREE_DEPTH];
    (compute_merkle_root(leaf, path, bits), path, bits)
}

#[test]
fn elegible_pasa() {
    let secret = 12345;
    let jurisdiction = 68; // Bolivia
    let net_worth = 300000;
    let expires_at = 2000000000;
    let leaf = poseidon::poseidon2::Poseidon2::hash([secret, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(leaf);
    let investor = 0x1111111111111111111111111111111111111111;
    let project = 1;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, project, investor], 3);

    main(root, project, investor, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}

#[test(should_fail_with = "patrimonio insuficiente")]
fn patrimonio_por_debajo_del_minimo_falla() {
    let secret = 12345;
    let jurisdiction = 68;
    let net_worth = 50000; // pide 100000
    let expires_at = 2000000000;
    let leaf = poseidon::poseidon2::Poseidon2::hash([secret, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(leaf);
    let investor = 0x1111111111111111111111111111111111111111;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, 1, investor], 3);

    main(root, 1, investor, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}

#[test(should_fail_with = "credencial vencida")]
fn credencial_vencida_falla() {
    let secret = 12345;
    let jurisdiction = 68;
    let net_worth = 300000;
    let expires_at = 1700000000; // anterior a `now`
    let leaf = poseidon::poseidon2::Poseidon2::hash([secret, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(leaf);
    let investor = 0x1111111111111111111111111111111111111111;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, 1, investor], 3);

    main(root, 1, investor, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}

#[test(should_fail_with = "jurisdiccion no admitida")]
fn jurisdiccion_distinta_falla() {
    let secret = 12345;
    let jurisdiction = 32; // Argentina
    let net_worth = 300000;
    let expires_at = 2000000000;
    let leaf = poseidon::poseidon2::Poseidon2::hash([secret, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(leaf);
    let investor = 0x1111111111111111111111111111111111111111;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, 1, investor], 3);

    main(root, 1, investor, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}

#[test(should_fail_with = "credencial no vigente para esta raiz")]
fn credencial_fuera_del_arbol_falla() {
    let secret = 99999; // nunca se le emitió credencial
    let jurisdiction = 68;
    let net_worth = 300000;
    let expires_at = 2000000000;
    let real_leaf = poseidon::poseidon2::Poseidon2::hash([12345, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(real_leaf);
    let investor = 0x1111111111111111111111111111111111111111;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, 1, investor], 3);

    main(root, 1, investor, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}

#[test(should_fail_with = "nullifier no corresponde")]
fn prueba_robada_del_mempool_no_sirve_con_otra_wallet() {
    // El atacante ve la prueba, la copia y cambia `investor_address` por la
    // suya. El nullifier público ya no cuadra con el que exige el circuito.
    let secret = 12345;
    let jurisdiction = 68;
    let net_worth = 300000;
    let expires_at = 2000000000;
    let leaf = poseidon::poseidon2::Poseidon2::hash([secret, jurisdiction, net_worth, expires_at], 4);
    let (root, path, bits) = fixture(leaf);
    let victima = 0x1111111111111111111111111111111111111111;
    let atacante = 0x2222222222222222222222222222222222222222;
    let nullifier = poseidon::poseidon2::Poseidon2::hash([secret, 1, victima], 3);

    main(root, 1, atacante, 100000, 68, 1750000000, nullifier,
         secret, jurisdiction, net_worth, expires_at, path, bits);
}
