use serde::{Deserialize, Serialize};

use crate::{Brush, Point};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Bucket {
    point: Point,
    brush: Brush,
    tolerance: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    selection: Option<Vec<Point>>,
}

impl Bucket {
    pub fn new(
        point: Point,
        brush: Brush,
        tolerance: u32,
        selection: Option<Vec<Point>>,
    ) -> Self {
        Bucket { point, brush, tolerance, selection }
    }

    pub fn set_selection(&mut self, selection: Option<Vec<Point>>) {
        self.selection = selection;
    }
}
