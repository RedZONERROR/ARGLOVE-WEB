const db = require('../config/db');

exports.addAddress = async (req, res, next) => {
  const { address_type = 'shipping', recipient_name, street_address, city, state, postal_code, phone_number } = req.body;

  if (!recipient_name || !street_address || !city || !state || !postal_code || !phone_number) {
    return res.status(400).json({ error: { message: 'All address details are required.' } });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO user_addresses (user_id, address_type, recipient_name, street_address, city, state, postal_code, phone_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, address_type, recipient_name, street_address, city, state, postal_code, phone_number]
    );

    res.status(201).json({
      message: 'Address added successfully.',
      address: {
        id: result.insertId,
        user_id: req.user.id,
        address_type,
        recipient_name,
        street_address,
        city,
        state,
        postal_code,
        phone_number
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAddress = async (req, res, next) => {
  const { id } = req.params;
  const { address_type = 'shipping', recipient_name, street_address, city, state, postal_code, phone_number } = req.body;

  if (!recipient_name || !street_address || !city || !state || !postal_code || !phone_number) {
    return res.status(400).json({ error: { message: 'All address details are required.' } });
  }

  try {
    const [addresses] = await db.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
    if (addresses.length === 0) {
      return res.status(404).json({ error: { message: 'Address not found.' } });
    }

    const address = addresses[0];
    if (address.user_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied. You do not own this address.' } });
    }

    await db.query(
      `UPDATE user_addresses 
       SET address_type = ?, recipient_name = ?, street_address = ?, city = ?, state = ?, postal_code = ?, phone_number = ? 
       WHERE id = ?`,
      [address_type, recipient_name, street_address, city, state, postal_code, phone_number, id]
    );

    res.status(200).json({
      message: 'Address updated successfully.',
      address: {
        id: parseInt(id, 10),
        user_id: req.user.id,
        address_type,
        recipient_name,
        street_address,
        city,
        state,
        postal_code,
        phone_number
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [addresses] = await db.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
    if (addresses.length === 0) {
      return res.status(404).json({ error: { message: 'Address not found.' } });
    }

    const address = addresses[0];
    if (address.user_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied. You do not own this address.' } });
    }

    await db.query('DELETE FROM user_addresses WHERE id = ?', [id]);

    res.status(200).json({ message: 'Address deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
