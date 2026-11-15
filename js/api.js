/* ================================================================
   MPN MATRIZ - capa de datos
   modo "supabase": base de datos real (pedidos, stock, cupones)
   modo "local":    vista previa sin Supabase configurado (datos de
                    ejemplo guardados en este navegador)
   modo "respaldo": Supabase no responde (ej. proyecto pausado); se
                    muestra el catalogo de respaldo y el pedido se manda
                    por WhatsApp sin descontar stock
   ================================================================ */
(function () {
  var C = window.MPN_CONFIG || {};
  var LS = "mpn-local-v1";
  var sb = null;
  var api = { modo: "local" };

  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function n2(x) { return Math.round(Number(x) * 100) / 100; }

  /* ---------- mensajes de error entendibles ---------- */
  api.mensajeError = function (e) {
    var m = String((e && (e.message || e.msg)) || e || "");
    var s = m.match(/SIN_STOCK:([^:]+)(?::(\d+))?/);
    if (s) {
      var q = s[2] != null ? Number(s[2]) : null;
      return q === 0 || q == null ? s[1] + " se acaba de agotar." : "De " + s[1] + " solo quedan " + q + ".";
    }
    if (/NO_DISPONIBLE/.test(m)) return "Uno de los productos ya no está disponible.";
    if (/CUPON_INVALIDO/.test(m)) return "El cupón ya no es válido para este pedido.";
    if (/FALTA_NOMBRE/.test(m)) return "Escribe tu nombre para el pedido.";
    if (/CANTIDAD_INVALIDA/.test(m)) return "Revisa las cantidades (máximo 20 por producto).";
    if (/CARRITO_INVALIDO/.test(m)) return "Tu carrito está vacío.";
    if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    return m || "Algo salió mal. Intenta de nuevo.";
  };

  /* ================= BACKEND LOCAL (vista previa) ================= */
  var L = {
    estado: null,
    cargar: function () {
      if (this.estado) return this.estado;
      var guardado = null;
      try { guardado = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
      // si el catalogo de respaldo cambio (productos nuevos), se reinicia la vista previa
      var huella = (window.MPN_RESPALDO || []).length + ":" + (window.MPN_RESPALDO || []).reduce(function (s, p) { return s + p.variantes.length; }, 0);
      if (guardado && guardado.huella !== huella) guardado = null;
      this.estado = guardado || { huella: huella,
        productos: copia(window.MPN_RESPALDO || []),
        cupones: [{ codigo: "MPN10", tipo: "porcentaje", valor: 10, minimo: 500, max_usos: null, usos: 0, vence: null, activo: true }],
        pedidos: [],
        folio: 1000
      };
      return this.estado;
    },
    guardar: function () { try { localStorage.setItem(LS, JSON.stringify(this.estado)); } catch (e) {} },
    variante: function (id) {
      var ps = this.cargar().productos;
      for (var i = 0; i < ps.length; i++) for (var j = 0; j < ps[i].variantes.length; j++)
        if (ps[i].variantes[j].id === id) return { p: ps[i], v: ps[i].variantes[j] };
      return null;
    },
    cupon: function (codigo) {
      codigo = String(codigo || "").trim().toUpperCase();
      return this.cargar().cupones.filter(function (c) { return c.codigo === codigo; })[0] || null;
    }
  };

  function validarCuponLocal(codigo, subtotal) {
    var c = L.cupon(codigo);
    if (!c || !c.activo) return { valido: false, mensaje: "Ese cupón no existe." };
    if (c.vence && c.vence < new Date().toISOString().slice(0, 10)) return { valido: false, mensaje: "Ese cupón ya venció." };
    if (c.max_usos != null && c.usos >= c.max_usos) return { valido: false, mensaje: "Ese cupón ya se agotó." };
    if (subtotal < Number(c.minimo || 0)) return { valido: false, mensaje: "Aplica en compras desde $" + Number(c.minimo).toLocaleString("es-MX") + "." };
    return { valido: true, codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), minimo: Number(c.minimo || 0) };
  }

  function crearPedidoLocal(items, cliente, cupon) {
    var st = L.cargar();
    if (!items || !items.length || items.length > 30) throw new Error("CARRITO_INVALIDO");
    var nombre = String(cliente.nombre || "").trim();
    if (!nombre) throw new Error("FALTA_NOMBRE");
    // validar todo antes de tocar el stock (todo o nada)
    var pedidos = {}, lineas = [], sub = 0;
    items.forEach(function (it) {
      var q = Number(it.cantidad) || 0;
      if (q < 1 || q > 20) throw new Error("CANTIDAD_INVALIDA");
      var x = L.variante(it.variante_id);
      if (!x || !x.v.activo || x.p.activo === false) throw new Error("NO_DISPONIBLE");
      pedidos[x.v.id] = (pedidos[x.v.id] || 0) + q;
      if (x.v.stock < pedidos[x.v.id]) throw new Error("SIN_STOCK:" + x.p.nombre + ":" + x.v.stock);
      lineas.push({ variante_id: x.v.id, producto_nombre: x.p.nombre,
        variante_texto: [x.v.sabor, x.v.tamano].filter(Boolean).join(" · ") || null, precio: Number(x.v.precio), cantidad: q });
      sub += Number(x.v.precio) * q;
    });
    var desc = 0, cod = null;
    if (cupon && String(cupon).trim()) {
      var r = validarCuponLocal(cupon, sub);
      if (!r.valido) throw new Error("CUPON_INVALIDO");
      cod = r.codigo;
      desc = r.tipo === "porcentaje" ? n2(sub * r.valor / 100) : Math.min(r.valor, sub);
      L.cupon(cod).usos++;
    }
    Object.keys(pedidos).forEach(function (id) { L.variante(id).v.stock -= pedidos[id]; });
    var folio = ++st.folio;
    st.pedidos.unshift({ id: folio, creado: new Date().toISOString(), cliente_nombre: nombre,
      cliente_tel: cliente.tel || null, entrega: cliente.entrega || "recoger", direccion: cliente.direccion || null,
      notas: cliente.notas || null, cupon: cod, subtotal: n2(sub), descuento: n2(desc), total: n2(sub - desc),
      estatus: "pendiente", pedido_items: lineas });
    L.guardar();
    return { folio: folio, subtotal: n2(sub), descuento: n2(desc), total: n2(sub - desc), cupon: cod };
  }

  /* ================= INICIO ================= */
  api.iniciar = function () {
    if (C.supabaseKey && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "mpn-admin" }
      });
      api.modo = "supabase";
    } else {
      api.modo = "local";
    }
    api.sb = sb;
    return api.modo;
  };

  /* ---------- catalogo ---------- */
  function ordenar(ps) {
    ps.forEach(function (p) {
      p.variantes = (p.variantes || []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    });
    return ps.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  api.catalogo = async function () {
    if (api.modo === "supabase") {
      try {
        // si Supabase tarda (proyecto pausado, red lenta) no dejamos la tienda en blanco
        var espera = new Promise(function (_, mal) { setTimeout(function () { mal(new Error("Supabase tardo demasiado")); }, 6000); });
        var r = await Promise.race([sb.from("productos").select("*, variantes(*)").order("orden"), espera]);
        if (r.error) throw r.error;
        return ordenar(r.data || []);
      } catch (e) {
        console.warn("[MPN] Supabase no respondio, usando respaldo:", e);
        api.modo = "respaldo";
        return ordenar(copia(window.MPN_RESPALDO || []));
      }
    }
    if (api.modo === "respaldo") return ordenar(copia(window.MPN_RESPALDO || []));
    return ordenar(copia(L.cargar().productos));
  };

  api.validarCupon = async function (codigo, subtotal) {
    if (api.modo === "supabase") {
      var r = await sb.rpc("validar_cupon", { p_codigo: codigo, p_subtotal: subtotal });
      if (r.error) throw r.error;
      return r.data;
    }
    if (api.modo === "respaldo") return { valido: false, mensaje: "Los cupones no están disponibles en este momento." };
    return validarCuponLocal(codigo, subtotal);
  };

  api.crearPedido = async function (items, cliente, cupon) {
    if (api.modo === "supabase") {
      var r = await sb.rpc("crear_pedido", { p_items: items, p_cliente: cliente, p_cupon: cupon || null });
      if (r.error) throw r.error;
      return r.data;
    }
    if (api.modo === "respaldo") return { folio: null, sinRegistro: true };
    return crearPedidoLocal(items, cliente, cupon);
  };

  /* ================= PANEL (admin) ================= */
  // si Supabase no responde, el panel no debe guardar nada en el navegador por error
  function noRespaldo() {
    if (api.modo === "respaldo") throw new Error("Sin conexión con la base de datos. Revisa tu internet o que el proyecto de Supabase esté activo.");
  }
  api.sesion = async function () {
    if (api.modo === "supabase") {
      var r = await sb.auth.getSession();
      return r.data && r.data.session ? r.data.session.user : null;
    }
    try { return JSON.parse(sessionStorage.getItem("mpn-local-sesion") || "null"); } catch (e) { return null; }
  };

  api.entrar = async function (email, pass) {
    if (api.modo === "supabase") {
      var r = await sb.auth.signInWithPassword({ email: email, password: pass });
      if (r.error) throw r.error;
      var ok = await sb.rpc("is_admin");
      if (ok.error || !ok.data) {
        await sb.auth.signOut();
        throw new Error("Ese usuario no tiene permiso de administrador.");
      }
      return r.data.user;
    }
    var u = { email: email || "vista-previa@mpn" };
    try { sessionStorage.setItem("mpn-local-sesion", JSON.stringify(u)); } catch (e) {}
    return u;
  };

  api.salir = async function () {
    if (api.modo === "supabase") await sb.auth.signOut();
    try { sessionStorage.removeItem("mpn-local-sesion"); } catch (e) {}
  };

  /* ---------- pedidos ---------- */
  api.pedidos = async function () {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("pedidos").select("*, pedido_items(*)").order("creado", { ascending: false }).limit(300);
      if (r.error) throw r.error;
      return r.data;
    }
    return copia(L.cargar().pedidos);
  };

  api.cambiarEstatus = async function (id, estatus) {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("pedidos").update({ estatus: estatus }).eq("id", id);
      if (r.error) throw r.error;
      return;
    }
    var st = L.cargar();
    var p = st.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.estatus === estatus) return;
    var suma = {};
    p.pedido_items.forEach(function (it) { if (it.variante_id) suma[it.variante_id] = (suma[it.variante_id] || 0) + it.cantidad; });
    if (p.estatus !== "cancelado" && estatus === "cancelado") {
      Object.keys(suma).forEach(function (vid) { var x = L.variante(vid); if (x) x.v.stock += suma[vid]; });
    } else if (p.estatus === "cancelado" && estatus !== "cancelado") {
      Object.keys(suma).forEach(function (vid) {
        var x = L.variante(vid);
        if (x && x.v.stock < suma[vid]) throw new Error("SIN_STOCK:" + x.p.nombre + ":" + x.v.stock);
      });
      Object.keys(suma).forEach(function (vid) { var x = L.variante(vid); if (x) x.v.stock -= suma[vid]; });
    }
    p.estatus = estatus;
    L.guardar();
  };

  /* ---------- productos ---------- */
  var CAMPOS_P = ["nombre", "marca", "categoria", "subcategoria", "objetivo", "descripcion", "foto_url", "etiqueta", "destacado", "activo", "orden", "slug"];
  var CAMPOS_V = ["sabor", "tamano", "precio", "precio_antes", "stock", "activo", "orden"];
  function solo(o, campos) { var r = {}; campos.forEach(function (k) { if (k in o) r[k] = o[k]; }); return r; }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "producto";
  }

  // guarda producto + variantes; p.variantes = lista final; borrados = ids de variantes a quitar
  api.guardarProducto = async function (p, borrados) {
    noRespaldo();
    borrados = borrados || [];
    var datos = solo(p, CAMPOS_P);
    if (!datos.slug) datos.slug = slugify((p.marca || "") + " " + p.nombre) + "-" + Date.now().toString(36);
    if (api.modo === "supabase") {
      var r;
      if (p.id) r = await sb.from("productos").update(datos).eq("id", p.id).select().single();
      else r = await sb.from("productos").insert(datos).select().single();
      if (r.error) throw r.error;
      var pid = r.data.id;
      for (var i = 0; i < borrados.length; i++) {
        var d = await sb.from("variantes").update({ activo: false, stock: 0 }).eq("id", borrados[i]); // se desactiva para no romper pedidos viejos
        if (d.error) throw d.error;
      }
      for (var j = 0; j < (p.variantes || []).length; j++) {
        var v = p.variantes[j], dv = solo(v, CAMPOS_V);
        dv.orden = j; dv.producto_id = pid;
        var rv = v.id ? await sb.from("variantes").update(dv).eq("id", v.id) : await sb.from("variantes").insert(dv);
        if (rv.error) throw rv.error;
      }
      return pid;
    }
    var st = L.cargar(), prod;
    if (p.id) prod = st.productos.filter(function (x) { return x.id === p.id; })[0];
    if (!prod) { prod = { id: "p-" + Date.now().toString(36), variantes: [] }; st.productos.unshift(prod); }
    Object.assign(prod, datos);
    prod.variantes = (prod.variantes || []).map(function (v) {
      return borrados.indexOf(v.id) >= 0 ? Object.assign(v, { activo: false, stock: 0 }) : v;
    });
    (p.variantes || []).forEach(function (v, k) {
      var dv = solo(v, CAMPOS_V); dv.orden = k;
      var ex = v.id && prod.variantes.filter(function (x) { return x.id === v.id; })[0];
      if (ex) Object.assign(ex, dv);
      else prod.variantes.push(Object.assign({ id: "v-" + Date.now().toString(36) + k }, dv));
    });
    L.guardar();
    return prod.id;
  };

  api.cambiarStock = async function (varianteId, stock) {
    noRespaldo();
    stock = Math.max(0, parseInt(stock, 10) || 0);
    if (api.modo === "supabase") {
      var r = await sb.from("variantes").update({ stock: stock }).eq("id", varianteId);
      if (r.error) throw r.error;
      return;
    }
    var x = L.variante(varianteId); if (x) { x.v.stock = stock; L.guardar(); }
  };

  api.cambiarPrecio = async function (varianteId, precio) {
    noRespaldo();
    precio = Math.max(0, Number(precio) || 0);
    if (api.modo === "supabase") {
      var r = await sb.from("variantes").update({ precio: precio }).eq("id", varianteId);
      if (r.error) throw r.error;
      return;
    }
    var x = L.variante(varianteId); if (x) { x.v.precio = precio; L.guardar(); }
  };

  api.ponerFoto = async function (productoId, url) {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("productos").update({ foto_url: url }).eq("id", productoId);
      if (r.error) throw r.error;
      return;
    }
    var p = L.cargar().productos.filter(function (x) { return x.id === productoId; })[0];
    if (p) { p.foto_url = url; L.guardar(); }
  };

  api.cambiarActivo = async function (productoId, activo) {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("productos").update({ activo: activo }).eq("id", productoId);
      if (r.error) throw r.error;
      return;
    }
    var p = L.cargar().productos.filter(function (x) { return x.id === productoId; })[0];
    if (p) { p.activo = activo; L.guardar(); }
  };

  api.agotar = async function (productoId) {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("variantes").update({ stock: 0 }).eq("producto_id", productoId);
      if (r.error) throw r.error;
      return;
    }
    var p = L.cargar().productos.filter(function (x) { return x.id === productoId; })[0];
    if (p) { p.variantes.forEach(function (v) { v.stock = 0; }); L.guardar(); }
  };

  api.borrarProducto = async function (productoId) {
    noRespaldo();
    if (api.modo === "supabase") {
      // los pedidos viejos conservan nombre y precio aunque el producto se borre
      var r = await sb.from("productos").delete().eq("id", productoId);
      if (r.error) throw r.error;
      return;
    }
    var st = L.cargar();
    st.productos = st.productos.filter(function (x) { return x.id !== productoId; });
    L.guardar();
  };

  // reduce la foto a 1000px en webp antes de subirla (carga rapida en celular)
  api.optimizarFoto = function (file) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var cx = cv.getContext("2d");
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? ok(b) : mal(new Error("No se pudo procesar la foto.")); }, "image/webp", 0.82);
      };
      img.onerror = function () { mal(new Error("Ese archivo no es una imagen válida.")); };
      img.src = url;
    });
  };

  api.subirFoto = async function (file) {
    noRespaldo();
    var blob = await api.optimizarFoto(file);
    if (api.modo === "supabase") {
      var ruta = "p/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7) + ".webp";
      var r = await sb.storage.from("productos").upload(ruta, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (r.error) throw r.error;
      return sb.storage.from("productos").getPublicUrl(ruta).data.publicUrl;
    }
    return await new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(blob); });
  };

  /* ---------- cupones ---------- */
  api.cupones = async function () {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("cupones").select("*").order("creado", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    }
    return copia(L.cargar().cupones);
  };

  api.guardarCupon = async function (c, nuevo) {
    noRespaldo();
    var d = {
      codigo: String(c.codigo || "").trim().toUpperCase().replace(/\s+/g, ""),
      tipo: c.tipo === "monto" ? "monto" : "porcentaje",
      valor: Number(c.valor), minimo: Number(c.minimo || 0),
      max_usos: c.max_usos === "" || c.max_usos == null ? null : parseInt(c.max_usos, 10),
      vence: c.vence || null, activo: c.activo !== false
    };
    if (!d.codigo) throw new Error("Escribe el código del cupón.");
    if (!(d.valor > 0)) throw new Error("El descuento debe ser mayor a 0.");
    if (d.tipo === "porcentaje" && d.valor > 100) throw new Error("El porcentaje no puede pasar de 100.");
    if (api.modo === "supabase") {
      var r = nuevo ? await sb.from("cupones").insert(d) : await sb.from("cupones").update(d).eq("codigo", d.codigo);
      if (r.error) throw (/duplicate/i.test(r.error.message) ? new Error("Ya existe un cupón con ese código.") : r.error);
      return;
    }
    var st = L.cargar(), ex = L.cupon(d.codigo);
    if (nuevo && ex) throw new Error("Ya existe un cupón con ese código.");
    if (ex) Object.assign(ex, d); else st.cupones.unshift(Object.assign({ usos: 0 }, d));
    L.guardar();
  };

  api.borrarCupon = async function (codigo) {
    noRespaldo();
    if (api.modo === "supabase") {
      var r = await sb.from("cupones").delete().eq("codigo", codigo);
      if (r.error) throw r.error;
      return;
    }
    var st = L.cargar();
    st.cupones = st.cupones.filter(function (c) { return c.codigo !== codigo; });
    L.guardar();
  };

  api.reiniciarLocal = function () { try { localStorage.removeItem(LS); } catch (e) {} L.estado = null; };

  window.MPN_API = api;
})();
