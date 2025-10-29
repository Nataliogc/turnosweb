/* ===== Datos de ejemplo · Turnos Web (Semana 44 / 2025) =====
   Estructura esperada por el adapter:
   window.DATA = {
     schedule: [
       {
         hotel: "Nombre Hotel",
         semana_lunes: "YYYY-MM-DD",        // lunes de la semana
         orden_empleados: ["...","..."],    // orden visual en filas
         turnos: [                          // lista de turnos día a día
           { empleado:"...", fecha:"YYYY-MM-DD", turno:"Mañana|Tarde|Noche|Descanso" },
           ...
         ]
       },
       ...
     ]
   }
----------------------------------------------------------------*/

window.DATA = {
  schedule: [
    /* ========== SERCOTEL GUADIANA ========== */
    {
      hotel: "Sercotel Guadiana",
      semana_lunes: "2025-10-27",
      orden_empleados: ["Diana", "Dani", "Macarena", "Federico", "Sergio Sánchez"],
      turnos: [
        // Lunes 27
        { empleado:"Diana",           fecha:"2025-10-27", turno:"Descanso" },
        { empleado:"Dani",            fecha:"2025-10-27", turno:"Mañana"  },
        { empleado:"Macarena",        fecha:"2025-10-27", turno:"Tarde"   },
        { empleado:"Federico",        fecha:"2025-10-27", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-10-27", turno:"—"       },

        // Martes 28
        { empleado:"Diana",           fecha:"2025-10-28", turno:"Descanso" },
        { empleado:"Dani",            fecha:"2025-10-28", turno:"Mañana"  },
        { empleado:"Macarena",        fecha:"2025-10-28", turno:"Tarde"   },
        { empleado:"Federico",        fecha:"2025-10-28", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-10-28", turno:"—"       },

        // Miércoles 29
        { empleado:"Diana",           fecha:"2025-10-29", turno:"Mañana"  },
        { empleado:"Dani",            fecha:"2025-10-29", turno:"Descanso"},
        { empleado:"Macarena",        fecha:"2025-10-29", turno:"Tarde"   },
        { empleado:"Federico",        fecha:"2025-10-29", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-10-29", turno:"—"       },

        // Jueves 30
        { empleado:"Diana",           fecha:"2025-10-30", turno:"Mañana"  },
        { empleado:"Dani",            fecha:"2025-10-30", turno:"Tarde"   },
        { empleado:"Macarena",        fecha:"2025-10-30", turno:"Tarde"   },
        { empleado:"Federico",        fecha:"2025-10-30", turno:"Descanso"},
        { empleado:"Sergio Sánchez",  fecha:"2025-10-30", turno:"—"       },

        // Viernes 31
        { empleado:"Diana",           fecha:"2025-10-31", turno:"Mañana"  },
        { empleado:"Dani",            fecha:"2025-10-31", turno:"Tarde"   },
        { empleado:"Macarena",        fecha:"2025-10-31", turno:"Descanso"},
        { empleado:"Federico",        fecha:"2025-10-31", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-10-31", turno:"—"       },

        // Sábado 01
        { empleado:"Diana",           fecha:"2025-11-01", turno:"Tarde"   },
        { empleado:"Dani",            fecha:"2025-11-01", turno:"Mañana"  },
        { empleado:"Macarena",        fecha:"2025-11-01", turno:"Descanso"},
        { empleado:"Federico",        fecha:"2025-11-01", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-11-01", turno:"—"       },

        // Domingo 02
        { empleado:"Diana",           fecha:"2025-11-02", turno:"Tarde"   },
        { empleado:"Dani",            fecha:"2025-11-02", turno:"Mañana"  },
        { empleado:"Macarena",        fecha:"2025-11-02", turno:"Descanso"},
        { empleado:"Federico",        fecha:"2025-11-02", turno:"Noche"   },
        { empleado:"Sergio Sánchez",  fecha:"2025-11-02", turno:"—"       }
      ]
    },

    /* ========== CUMBRIA SPA&HOTEL ========== */
    {
      hotel: "Cumbria Spa&Hotel",
      semana_lunes: "2025-10-27",
      orden_empleados: ["Cristina", "Isabel Hidalgo", "Miriam", "Natalio", "Sergio", "Valentín"],
      turnos: [
        // Lunes 27
        { empleado:"Cristina",       fecha:"2025-10-27", turno:"Tarde"   },
        { empleado:"Isabel Hidalgo", fecha:"2025-10-27", turno:"—"       },
        { empleado:"Miriam",         fecha:"2025-10-27", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-10-27", turno:"Descanso"},
        { empleado:"Sergio",         fecha:"2025-10-27", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-10-27", turno:"Noche"   },

        // Martes 28
        { empleado:"Cristina",       fecha:"2025-10-28", turno:"Tarde"   },
        { empleado:"Isabel Hidalgo", fecha:"2025-10-28", turno:"Mañana"  },
        { empleado:"Miriam",         fecha:"2025-10-28", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-10-28", turno:"Descanso"},
        { empleado:"Sergio",         fecha:"2025-10-28", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-10-28", turno:"Descanso"},

        // Miércoles 29
        { empleado:"Cristina",       fecha:"2025-10-29", turno:"Tarde"   },
        { empleado:"Isabel Hidalgo", fecha:"2025-10-29", turno:"Mañana"  },
        { empleado:"Miriam",         fecha:"2025-10-29", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-10-29", turno:"Mañana"  },
        { empleado:"Sergio",         fecha:"2025-10-29", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-10-29", turno:"Descanso"},

        // Jueves 30
        { empleado:"Cristina",       fecha:"2025-10-30", turno:"Tarde"   },
        { empleado:"Isabel Hidalgo", fecha:"2025-10-30", turno:"—"       },
        { empleado:"Miriam",         fecha:"2025-10-30", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-10-30", turno:"Mañana"  },
        { empleado:"Sergio",         fecha:"2025-10-30", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-10-30", turno:"Noche"   },

        // Viernes 31
        { empleado:"Cristina",       fecha:"2025-10-31", turno:"Tarde"   },
        { empleado:"Isabel Hidalgo", fecha:"2025-10-31", turno:"—"       },
        { empleado:"Miriam",         fecha:"2025-10-31", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-10-31", turno:"Mañana"  },
        { empleado:"Sergio",         fecha:"2025-10-31", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-10-31", turno:"Noche"   },

        // Sábado 01
        { empleado:"Cristina",       fecha:"2025-11-01", turno:"Mañana"  },
        { empleado:"Isabel Hidalgo", fecha:"2025-11-01", turno:"—"       },
        { empleado:"Miriam",         fecha:"2025-11-01", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-11-01", turno:"Mañana"  },
        { empleado:"Sergio",         fecha:"2025-11-01", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-11-01", turno:"Noche"   },

        // Domingo 02
        { empleado:"Cristina",       fecha:"2025-11-02", turno:"Mañana"  },
        { empleado:"Isabel Hidalgo", fecha:"2025-11-02", turno:"—"       },
        { empleado:"Miriam",         fecha:"2025-11-02", turno:"—"       },
        { empleado:"Natalio",        fecha:"2025-11-02", turno:"Mañana"  },
        { empleado:"Sergio",         fecha:"2025-11-02", turno:"Vacaciones"},
        { empleado:"Valentín",       fecha:"2025-11-02", turno:"Noche"   }
      ]
    }
  ]
};

/* ===== Compatibilidad APP MÓVIL =====
   Esta sección no afecta a index.html ni a live.html.
   Solo expone los datos al entorno móvil (live.mobile.html).
   -------------------------------------------------------- */
(function(){
  try {
    // Detectar la fuente principal de datos (DATA o FULL_DATA)
    const src =
      (typeof window.FULL_DATA !== "undefined" && window.FULL_DATA && Object.keys(window.FULL_DATA).length) ? window.FULL_DATA :
      (typeof window.DATA !== "undefined" && window.DATA && Object.keys(window.DATA).length) ? window.DATA :
      (typeof DATA !== "undefined" && DATA) ? DATA :
      null;

    // Solo si no estaba ya definida para el móvil
    if (!window.FULL_DATA && src) {
      window.FULL_DATA = src;
      // En móvil algunos motores consultan DATA
      if (!window.DATA) window.DATA = window.FULL_DATA;
      console.log("[APP móvil] Datos cargados desde fuente:", src.schedule ? "schedule" : Object.keys(src));
    }
  } catch (err) {
    console.error("[APP móvil] No se pudo inicializar los datos:", err);
  }
})();
